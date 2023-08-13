import { Injectable } from '@nestjs/common';
import type { User } from '@/models/index.js';
import type Logger from '@/logger.js';
import * as Acct from '@/misc/acct.js';
import { RemoteUserResolveService } from '@/core/RemoteUserResolveService.js';
import { DownloadService } from '@/core/DownloadService.js';
import { UtilityService } from '@/core/UtilityService.js';
import { bindThis } from '@/decorators.js';
import { QueueService } from '@/core/QueueService.js';
import { PrismaService } from '@/core/PrismaService.js';
import { QueueLoggerService } from '../QueueLoggerService.js';
import type * as Bull from 'bullmq';
import type { DbUserImportJobData, DbUserImportToDbJobData } from '../types.js';
import type { user } from '@prisma/client';

@Injectable()
export class ImportFollowingProcessorService {
	private logger: Logger;

	constructor(
		private readonly queueService: QueueService,
		private readonly utilityService: UtilityService,
		private readonly remoteUserResolveService: RemoteUserResolveService,
		private readonly downloadService: DownloadService,
		private readonly queueLoggerService: QueueLoggerService,
		private readonly prismaService: PrismaService,
	) {
		this.logger = this.queueLoggerService.logger.createSubLogger('import-following');
	}

	@bindThis
	public async process(job: Bull.Job<DbUserImportJobData>): Promise<void> {
		this.logger.info(`Importing following of ${job.data.user.id} ...`);

		const user = await this.prismaService.client.user.findUnique({ where: { id: job.data.user.id } });
		if (user == null) {
			return;
		}

		const file = await this.prismaService.client.drive_file.findUnique({
			where: {
				id: job.data.fileId,
			},
		});
		if (file == null) {
			return;
		}

		const csv = await this.downloadService.downloadTextFile(file.url);
		const targets = csv.trim().split('\n');
		this.queueService.createImportFollowingToDbJob({ id: user.id }, targets);

		this.logger.succ('Import jobs created');
	}

	@bindThis
	public async processDb(job: Bull.Job<DbUserImportToDbJobData>): Promise<void> {
		const line = job.data.target;
		const user = job.data.user;

		try {
			const acct = line.split(',')[0].trim();
			const { username, host } = Acct.parse(acct);

			if (!host) return;

			let target: user | null = this.utilityService.isSelfHost(host)
				? await this.prismaService.client.user.findFirst({
					where: {
						host: null,
						usernameLower: username.toLowerCase(),
					},
				})
				: await this.prismaService.client.user.findUnique({
					where: {
						usernameLower_host: {
							host: this.utilityService.toPuny(host),
							usernameLower: username.toLowerCase(),
						},
					},
				});

			if (host == null && target == null) return;

			if (target == null) {
				target = await this.remoteUserResolveService.resolveUser(username, host);
			}

			if (target == null) {
				throw new Error(`Unable to resolve user: @${username}@${host}`);
			}

			// skip myself
			if (target.id === job.data.user.id) return;

			this.logger.info(`Follow ${target.id} ...`);

			this.queueService.createFollowJob([{ from: user, to: { id: target.id }, silent: true }]);
		} catch (e) {
			this.logger.warn(`Error: ${e}`);
		}
	}
}
