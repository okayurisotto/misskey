import { Injectable } from '@nestjs/common';
import { AcctFactory } from '@/factories/AcctFactory.js';
import { RemoteUserResolveService } from '@/core/RemoteUserResolveService.js';
import { DownloadService } from '@/core/DownloadService.js';
import { UserMutingService } from '@/core/UserMutingService.js';
import { PrismaService } from '@/core/PrismaService.js';
import { QueueLoggerService } from '../QueueLoggerService.js';
import type * as Bull from 'bullmq';
import type { DbUserImportJobData } from '../types.js';

@Injectable()
export class ImportMutingProcessorService {
	private readonly logger;

	constructor(
		private readonly userMutingService: UserMutingService,
		private readonly remoteUserResolveService: RemoteUserResolveService,
		private readonly downloadService: DownloadService,
		private readonly queueLoggerService: QueueLoggerService,
		private readonly prismaService: PrismaService,
		private readonly acctFactory: AcctFactory,
	) {
		this.logger =
			this.queueLoggerService.logger.createSubLogger('import-muting');
	}

	public async process(job: Bull.Job<DbUserImportJobData>): Promise<void> {
		this.logger.info(`Importing muting of ${job.data.user.id} ...`);

		const user = await this.prismaService.client.user.findUnique({
			where: { id: job.data.user.id },
		});
		if (user === null) return;

		const file = await this.prismaService.client.driveFile.findUnique({
			where: { id: job.data.fileId },
		});
		if (file === null) return;

		const csv = await this.downloadService.downloadTextFile(file.url);

		let linenum = 0;

		for (const line of csv.trim().split('\n')) {
			linenum++;

			try {
				const acctStr = line.split(',')[0]?.trim();
				if (acctStr === undefined) throw new Error();

				const acct = this.acctFactory.parse(acctStr);

				if (acct.host.isOmitted()) continue;

				const target =
					(await this.prismaService.client.user.findFirst({
						where: acct.whereUser(),
					})) ??
					(await this.remoteUserResolveService.resolveUser(
						acct.username,
						acct.host.toASCII(),
					));

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
