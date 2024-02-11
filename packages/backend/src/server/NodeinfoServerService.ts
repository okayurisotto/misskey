import { Injectable } from '@nestjs/common';
import { z } from 'zod';
import { MetaService } from '@/core/MetaService.js';
import { MAX_NOTE_TEXT_LENGTH } from '@/const.js';
import NotesChart from '@/core/chart/charts/notes.js';
import UsersChart from '@/core/chart/charts/users.js';
import { DEFAULT_POLICIES } from '@/core/RoleService.js';
import { PrismaService } from '@/core/PrismaService.js';
import type { UserLiteSchema } from '@/models/zod/UserLiteSchema.js';
import { ConfigLoaderService } from '@/ConfigLoaderService.js';
import { UserEntityPackLiteService } from '@/core/entities/UserEntityPackLiteService.js';
import type { FastifyInstance, FastifyPluginOptions } from 'fastify';

const nodeinfo2_1path = '/nodeinfo/2.1';
const nodeinfo2_0path = '/nodeinfo/2.0';

type NodeInfo2 = {
	software: {
		name: string;
		version: string;
		repository: string;
	};
	protocols: string[];
	services: {
		inbound: string[];
		outbound: string[];
	};
	openRegistrations: boolean;
	usage: {
		users: {
			total: number;
			activeHalfyear: null;
			activeMonth: null;
		};
		localPosts: number;
		localComments: number;
	};
	metadata: {
		nodeName: string | null;
		nodeDescription: string | null;
		maintainer: {
			name: string | null;
			email: string | null;
		};
		langs: string[];
		tosUrl: string | null;
		repositoryUrl: string;
		feedbackUrl: string | null;
		disableRegistration: boolean;
		disableLocalTimeline: boolean;
		disableGlobalTimeline: boolean;
		emailRequiredForSignup: boolean;
		enableHcaptcha: boolean;
		enableRecaptcha: boolean;
		maxNoteTextLength: number;
		enableEmail: boolean;
		enableServiceWorker: boolean;
		proxyAccountName: string | null;
		themeColor: string;
	};
};

@Injectable()
export class NodeinfoServerService {
	constructor(
		private readonly configLoaderService: ConfigLoaderService,
		private readonly metaService: MetaService,
		private readonly notesChart: NotesChart,
		private readonly prismaService: PrismaService,
		private readonly userEntityPackLiteService: UserEntityPackLiteService,
		private readonly usersChart: UsersChart,
	) {}

	public getLinks(): { rel: string; href: string }[] {
		return [
			/* (awaiting release) {
			rel: 'http://nodeinfo.diaspora.software/ns/schema/2.1',
			href: config.url + nodeinfo2_1path
		}, */ {
				rel: 'http://nodeinfo.diaspora.software/ns/schema/2.0',
				href: this.configLoaderService.data.url + nodeinfo2_0path,
			},
		];
	}

	public createServer(
		fastify: FastifyInstance,
		options: FastifyPluginOptions,
		done: (err?: Error) => void,
	): void {
		const nodeinfo2 = async (): Promise<NodeInfo2> => {
			const now = Date.now();

			const notesChart = await this.notesChart.getChart('hour', 1, null);
			const localPosts = notesChart.local.total[0];

			const usersChart = await this.usersChart.getChart('hour', 1, null);
			const total = usersChart.local.total[0];

			const [
				meta,
				//activeHalfyear,
				//activeMonth,
			] = await Promise.all([
				this.metaService.fetch(),
				// 重い
				//this.usersRepository.count({ where: { host: IsNull(), lastActiveDate: MoreThan(new Date(now - 15552000000)) } }),
				//this.usersRepository.count({ where: { host: IsNull(), lastActiveDate: MoreThan(new Date(now - 2592000000)) } }),
			]);

			const activeHalfyear = null;
			const activeMonth = null;

			const getProxyAccount = async (): Promise<z.infer<
				typeof UserLiteSchema
			> | null> => {
				if (meta.proxyAccountId === null) return null;

				try {
					const proxyAccount =
						await this.prismaService.client.user.findUniqueOrThrow({
							where: { id: meta.proxyAccountId },
						});
					return await this.userEntityPackLiteService.packLite(proxyAccount);
				} catch {
					return null;
				}
			};

			const proxyAccount = await getProxyAccount();

			const basePolicies = {
				...DEFAULT_POLICIES,
				...z.record(z.string(), z.any()).parse(meta.policies),
			};

			return {
				software: {
					name: 'misskey',
					version: this.configLoaderService.data.version,
					repository: meta.repositoryUrl,
				},
				protocols: ['activitypub'],
				services: {
					inbound: [] as string[],
					outbound: ['atom1.0', 'rss2.0'],
				},
				openRegistrations: !meta.disableRegistration,
				usage: {
					users: { total, activeHalfyear, activeMonth },
					localPosts,
					localComments: 0,
				},
				metadata: {
					nodeName: meta.name,
					nodeDescription: meta.description,
					maintainer: {
						name: meta.maintainerName,
						email: meta.maintainerEmail,
					},
					langs: meta.langs,
					tosUrl: meta.termsOfServiceUrl,
					repositoryUrl: meta.repositoryUrl,
					feedbackUrl: meta.feedbackUrl,
					disableRegistration: meta.disableRegistration,
					disableLocalTimeline: !basePolicies.ltlAvailable,
					disableGlobalTimeline: !basePolicies.gtlAvailable,
					emailRequiredForSignup: meta.emailRequiredForSignup,
					enableHcaptcha: meta.enableHcaptcha,
					enableRecaptcha: meta.enableRecaptcha,
					maxNoteTextLength: MAX_NOTE_TEXT_LENGTH,
					enableEmail: meta.enableEmail,
					enableServiceWorker: meta.enableServiceWorker,
					proxyAccountName: proxyAccount ? proxyAccount.username : null,
					themeColor: meta.themeColor ?? '#86b300',
				},
			};
		};

		fastify.get(nodeinfo2_1path, async (request, reply) => {
			const base = await nodeinfo2();

			reply.header('Cache-Control', 'public, max-age=600');
			return { version: '2.1', ...base };
		});

		fastify.get(nodeinfo2_0path, async (request, reply) => {
			const base = await nodeinfo2();

			delete (base as any).software.repository;

			reply.header('Cache-Control', 'public, max-age=600');
			return { version: '2.0', ...base };
		});

		done();
	}
}
