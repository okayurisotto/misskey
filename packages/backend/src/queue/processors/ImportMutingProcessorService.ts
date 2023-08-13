import { Injectable } from '@nestjs/common';
import type { User } from '@/models/index.js';
import type Logger from '@/logger.js';
import * as Acct from '@/misc/acct.js';
import { RemoteUserResolveService } from '@/core/RemoteUserResolveService.js';
import { DownloadService } from '@/core/DownloadService.js';
import { UserMutingService } from '@/core/UserMutingService.js';
import { UtilityService } from '@/core/UtilityService.js';
import { bindThis } from '@/decorators.js';
import { PrismaService } from '@/core/PrismaService.js';
import { QueueLoggerService } from '../QueueLoggerService.js';
import type * as Bull from 'bullmq';
import type { DbUserImportJobData } from '../types.js';
import type { user } from '@prisma/client';

@Injectable()
export class ImportMutingProcessorService {
	private readonly logger: Logger;

	constructor(
		private readonly utilityService: UtilityService,
		private readonly userMutingService: UserMutingService,
		private readonly remoteUserResolveService: RemoteUserResolveService,
		private readonly downloadService: DownloadService,
		private readonly queueLoggerService: QueueLoggerService,
		private readonly prismaService: PrismaService,
	) {
		this.logger = this.queueLoggerService.logger.createSubLogger('import-muting');
	}

	@bindThis
	public async process(job: Bull.Job<DbUserImportJobData>): Promise<void> {
		this.logger.info(`Importing muting of ${job.data.user.id} ...`);

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

		let linenum = 0;

		for (const line of csv.trim().split('\n')) {
			linenum++;

			try {
				const acct = line.split(',')[0].trim();
				const { username, host } = Acct.parse(acct);

				if (!host) continue;

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

				if (host == null && target == null) continue;

				if (target == null) {
					target = await this.remoteUserResolveService.resolveUser(username, host);
				}

				if (target == null) {
					throw new Error(`cannot resolve user: @${username}@${host}`);
				}

				// skip myself
				if (target.id === job.data.user.id) continue;

				this.logger.info(`Mute[${linenum}] ${target.id} ...`);

				await this.userMutingService.mute(user, target);
			} catch (e) {
				this.logger.warn(`Error in line:${linenum} ${e}`);
			}
		}

		this.logger.succ('Imported');
	}
}
