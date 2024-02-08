import cluster from 'node:cluster';
import * as fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { Injectable, OnApplicationShutdown } from '@nestjs/common';
import Fastify, { FastifyInstance } from 'fastify';
import fastifyStatic from '@fastify/static';
import { z } from 'zod';
import { NODE_ENV } from '@/env.js';
import { GlobalEventService } from '@/core/GlobalEventService.js';
import Logger from '@/misc/logger.js';
import * as Acct from '@/misc/acct.js';
import { genIdenticon } from '@/misc/gen-identicon.js';
import { UserEntityService } from '@/core/entities/UserEntityService.js';
import { MetaService } from '@/core/MetaService.js';
import { PrismaService } from '@/core/PrismaService.js';
import { ProcessMessage } from '@/boot/ProcessMessage.js';
import { ConfigLoaderService } from '@/ConfigLoaderService.js';
import { ActivityPubServerService } from './ActivityPubServerService.js';
import { NodeinfoServerService } from './NodeinfoServerService.js';
import { ApiServerService } from './api/ApiServerService.js';
import { StreamingApiServerService } from './api/StreamingApiServerService.js';
import { WellKnownServerService } from './WellKnownServerService.js';
import { FileServerService } from './FileServerService.js';
import { ClientServerService } from './web/ClientServerService.js';
import { OpenApiServerService } from './api/openapi/OpenApiServerService.js';
import { UserEntityUtilService } from '@/core/entities/UserEntityUtilService.js';

const _dirname = fileURLToPath(new URL('.', import.meta.url));

@Injectable()
export class ServerService implements OnApplicationShutdown {
	private readonly logger = new Logger('server', 'gray');
	private fastify: FastifyInstance | null = null;

	constructor(
		private readonly activityPubServerService: ActivityPubServerService,
		private readonly apiServerService: ApiServerService,
		private readonly clientServerService: ClientServerService,
		private readonly configLoaderService: ConfigLoaderService,
		private readonly fileServerService: FileServerService,
		private readonly globalEventService: GlobalEventService,
		private readonly metaService: MetaService,
		private readonly nodeinfoServerService: NodeinfoServerService,
		private readonly openApiServerService: OpenApiServerService,
		private readonly prismaService: PrismaService,
		private readonly streamingApiServerService: StreamingApiServerService,
		private readonly userEntityService: UserEntityService,
		private readonly userEntityUtilService: UserEntityUtilService,
		private readonly wellKnownServerService: WellKnownServerService,
	) {}

	public async launch(): Promise<void> {
		const fastify = Fastify({
			trustProxy: true,
			logger: NODE_ENV !== 'production' && NODE_ENV !== 'test',
		});
		this.fastify = fastify;

		// HSTS
		if (
			this.configLoaderService.data.url.startsWith('https') &&
			!this.configLoaderService.data.disableHsts
		) {
			fastify.addHook('onRequest', async (_request, reply) => {
				reply.header('strict-transport-security', 'max-age=15552000; preload'); // 6 months
			});
		}

		// Register non-serving static server so that the child services can use reply.sendFile.
		// `root` here is just a placeholder and each call must use its own `rootPath`.
		await fastify.register(fastifyStatic, { root: _dirname, serve: false });

		await fastify.register(
			(fastifyInstance, options, done) => {
				return this.apiServerService.createServer(
					fastifyInstance,
					options,
					done,
				);
			},
			{ prefix: '/api' },
		);
		await fastify.register((fastifyInstance, options, done) => {
			return this.openApiServerService.createServer(
				fastifyInstance,
				options,
				done,
			);
		});
		await fastify.register((fastifyInstance, options, done) => {
			return this.fileServerService.createServer(
				fastifyInstance,
				options,
				done,
			);
		});
		await fastify.register((fastifyInstance, options, done) => {
			return this.activityPubServerService.createServer(
				fastifyInstance,
				options,
				done,
			);
		});
		await fastify.register((fastifyInstance, options, done) => {
			return this.nodeinfoServerService.createServer(
				fastifyInstance,
				options,
				done,
			);
		});
		await fastify.register((fastifyInstance, options, done) => {
			return this.wellKnownServerService.createServer(
				fastifyInstance,
				options,
				done,
			);
		});
		await fastify.register((fastifyInstance, options, done) => {
			return this.clientServerService.createServer(
				fastifyInstance,
				options,
				done,
			);
		});
		this.streamingApiServerService.attach(fastify.server);

		// media proxy経由の絵文字URLへリダイレクト
		fastify.get('/emoji/:path(.*)', async (request, reply) => {
			const params = z
				.object({
					path: z.string(),
				})
				.parse(request.params);

			const queries = z
				.object({
					static: z.unknown().optional(),
					badge: z.unknown().optional(),
					fallback: z.unknown().optional(),
				})
				.parse(request.query);

			const path = params.path;

			reply.header('Cache-Control', 'public, max-age=86400');

			if (!path.match(/^[a-zA-Z0-9\-_@.]+?\.webp$/)) {
				reply.code(404);
				return;
			}

			reply.header(
				'Content-Security-Policy',
				"default-src 'none'; style-src 'unsafe-inline'",
			);

			const segments = z.string().array().parse(path.split('@'));
			const name = segments[0].replace('.webp', '');
			const host = segments[1]?.replace('.webp', '');

			const emoji = await this.prismaService.client.customEmoji.findFirst({
				where: {
					// `@.` is the spec of ReactionService.decodeReaction
					host: host === undefined || host === '.' ? null : host,
					name: name,
				},
			});

			if (emoji === null) {
				if ('fallback' in queries) {
					return reply.redirect('/static-assets/emoji-unknown.png');
				} else {
					reply.code(404);
					return;
				}
			}

			let url: URL;
			if ('badge' in queries) {
				url = new URL('emoji.png', this.configLoaderService.data.mediaProxy);
				url.searchParams.set(
					'url',
					emoji.publicUrl === '' ? emoji.originalUrl : emoji.publicUrl,
				);
				url.searchParams.set('badge', '1');
			} else {
				url = new URL('emoji.webp', this.configLoaderService.data.mediaProxy);
				url.searchParams.set(
					'url',
					emoji.publicUrl === '' ? emoji.originalUrl : emoji.publicUrl,
				);
				url.searchParams.set('emoji', '1');
				if ('static' in queries) {
					url.searchParams.set('static', '1');
				}
			}

			return reply.redirect(301, url.toString());
		});

		// media proxy経由のアバターURLへリダイレクト
		fastify.get('/avatar/@:acct', async (request, reply) => {
			const params = z.object({ acct: z.string() }).parse(request.params);

			const { username, host } = Acct.parse(params.acct);
			const user = await this.prismaService.client.user.findFirst({
				where: {
					usernameLower: username.toLowerCase(),
					host:
						host == null || host === this.configLoaderService.data.host
							? null
							: host,
					isSuspended: false,
				},
			});

			reply.header('Cache-Control', 'public, max-age=86400');

			if (user) {
				if (user.avatarUrl) {
					reply.redirect(user.avatarUrl);
				} else {
					reply.redirect(this.userEntityUtilService.getIdenticonUrl(user));
				}
			} else {
				reply.redirect('/static-assets/user-unknown.png');
			}
		});

		// Identicon
		fastify.get('/identicon/:x', async (request, reply) => {
			const params = z.object({ x: z.string() }).parse(request.params);

			reply.header('Content-Type', 'image/png');
			reply.header('Cache-Control', 'public, max-age=86400');

			const meta = await this.metaService.fetch();

			if (meta.enableIdenticonGeneration) {
				return Buffer.from(await genIdenticon(params.x));
			} else {
				return reply.redirect('/static-assets/avatar.png');
			}
		});

		// メールアドレス認証
		fastify.get('/verify-email/:code', async (request, reply) => {
			const params = z.object({ code: z.string() }).parse(request.params);

			const profile = await this.prismaService.client.user_profile.findFirst({
				where: { emailVerifyCode: params.code },
			});

			if (profile === null) {
				reply.code(404);
				return;
			}

			await this.prismaService.client.user_profile.updateMany({
				where: {
					userId: profile.userId,
					emailVerifyCode: params.code,
				},
				data: {
					emailVerified: true,
					emailVerifyCode: null,
				},
			});

			this.globalEventService.publishMainStream(
				profile.userId,
				'meUpdated',
				await this.userEntityService.packDetailedMe(profile.userId, {
					includeSecrets: true,
				}),
			);

			reply.code(200);
			return 'Verify succeeded!';
		});

		fastify.server.on('error', (err) => {
			if ('code' in err) {
				switch (err.code) {
					case 'EACCES':
						this.logger.error(
							`You do not have permission to listen on port ${this.configLoaderService.data.port}.`,
						);
						break;
					case 'EADDRINUSE':
						this.logger.error(
							`Port ${this.configLoaderService.data.port} is already in use by another process.`,
						);
						break;
					default:
						this.logger.error(err);
						break;
				}

				if (cluster.isWorker) {
					process.send?.(ProcessMessage.ListenFailed);
				} else {
					// disableClustering
					process.exit(1);
				}
			} else {
				this.logger.error(err);

				if (cluster.isWorker) {
					process.send?.(ProcessMessage.ListenFailed);
				} else {
					// disableClustering
					process.exit(1);
				}
			}
		});

		if (this.configLoaderService.data.socket !== undefined) {
			if (fs.existsSync(this.configLoaderService.data.socket)) {
				fs.unlinkSync(this.configLoaderService.data.socket);
			}
			await fastify.listen({ path: this.configLoaderService.data.socket });
			if (this.configLoaderService.data.chmodSocket !== undefined) {
				fs.chmodSync(
					this.configLoaderService.data.socket,
					this.configLoaderService.data.chmodSocket,
				);
			}
		} else {
			await fastify.listen({
				port: this.configLoaderService.data.port,
				host: '0.0.0.0',
			});
		}

		await fastify.ready();
	}

	public async dispose(): Promise<void> {
		await this.streamingApiServerService.detach();
		await this.fastify?.close();
	}

	async onApplicationShutdown(): Promise<void> {
		await this.dispose();
	}
}
