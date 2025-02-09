import * as fs from 'node:fs';
import { Injectable } from '@nestjs/common';
import { format as dateFormat } from 'date-fns';
import { createTemp } from '@/misc/create-temp.js';
import { PrismaService } from '@/core/PrismaService.js';
import { DriveFileAddService } from '@/core/DriveFileAddService.js';
import { AcctFactory } from '@/factories/AcctFactory.js';
import { QueueLoggerService } from '../QueueLoggerService.js';
import type * as Bull from 'bullmq';
import type { DbJobDataWithUser } from '../types.js';

@Injectable()
export class ExportBlockingProcessorService {
	private readonly logger;

	constructor(
		private readonly queueLoggerService: QueueLoggerService,
		private readonly prismaService: PrismaService,
		private readonly driveFileAddService: DriveFileAddService,
		private readonly acctFactory: AcctFactory,
	) {
		this.logger =
			this.queueLoggerService.logger.createSubLogger('export-blocking');
	}

	public async process(job: Bull.Job<DbJobDataWithUser>): Promise<void> {
		this.logger.info(`Exporting blocking of ${job.data.user.id} ...`);

		const user = await this.prismaService.client.user.findUnique({
			where: { id: job.data.user.id },
			include: {
				blockings_blocker: {
					include: { blockee: true },
				},
			},
		});
		if (user == null) return;

		// Create temp file
		const [path, cleanup] = await createTemp();

		try {
			const content = user.blockings_blocker
				.map((blocking) => {
					const user = blocking.blockee;
					return this.acctFactory.create(user.username, user.host).formatLong();
				})
				.map((entry) => entry + '\n')
				.join('');

			fs.writeFileSync(path, content);

			const fileName =
				'blocking-' + dateFormat(new Date(), 'yyyy-MM-dd-HH-mm-ss') + '.csv';
			const driveFile = await this.driveFileAddService.add({
				user,
				path,
				name: fileName,
				force: true,
				ext: 'csv',
			});

			this.logger.succ(`Exported to: ${driveFile.id}`);
		} finally {
			cleanup();
		}
	}
}
