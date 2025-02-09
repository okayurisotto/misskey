import { Injectable } from '@nestjs/common';
import { AcctFactory } from '@/factories/AcctFactory.js';
import { RemoteUserResolveService } from '@/core/RemoteUserResolveService.js';
import { DownloadService } from '@/core/DownloadService.js';
import { QueueService } from '@/core/QueueService.js';
import { PrismaService } from '@/core/PrismaService.js';
import { QueueLoggerService } from '../QueueLoggerService.js';
import type * as Bull from 'bullmq';
import type { DbUserImportJobData, DbUserImportToDbJobData } from '../types.js';

@Injectable()
export class ImportBlockingProcessorService {
	private readonly logger;

	constructor(
		private readonly queueService: QueueService,
		private readonly remoteUserResolveService: RemoteUserResolveService,
		private readonly downloadService: DownloadService,
		private readonly queueLoggerService: QueueLoggerService,
		private readonly prismaService: PrismaService,
		private readonly acctFactory: AcctFactory,
	) {
		this.logger =
			this.queueLoggerService.logger.createSubLogger('import-blocking');
	}

	public async process(job: Bull.Job<DbUserImportJobData>): Promise<void> {
		this.logger.info(`Importing blocking of ${job.data.user.id} ...`);

		const file = await this.prismaService.client.driveFile.findUnique({
			where: { id: job.data.fileId, userId: job.data.user.id },
			include: { user: true },
		});
		if (file === null) return;
		if (file.user === null) return;

		const csv = await this.downloadService.downloadTextFile(file.url);
		const targets = csv.trim().split('\n');

		await this.queueService.createImportBlockingToDbJob(
			{ id: file.user.id },
			targets,
		);

		this.logger.succ('Import jobs created');
	}

	public async processDb(
		job: Bull.Job<DbUserImportToDbJobData>,
	): Promise<void> {
		const line = job.data.target;
		const user = job.data.user;

		try {
			const acctStr = line.split(',')[0]?.trim();
			if (acctStr === undefined) throw new Error();

			const acct = this.acctFactory.parse(acctStr);

			if (acct.host.isOmitted()) return;

			const target =
				(await this.prismaService.client.user.findFirst({
					where: acct.whereUser(),
				})) ??
				(await this.remoteUserResolveService.resolveUser(
					acct.username,
					acct.host.toASCII(),
				));

			// skip myself
			if (target.id === job.data.user.id) return;

			this.logger.info(`Block ${target.id} ...`);

			await this.queueService.createBlockJob([
				{ from: { id: user.id }, to: { id: target.id }, silent: true },
			]);
		} catch (e) {
			this.logger.warn(`Error: ${e}`);
		}
	}
}
