import * as fs from 'node:fs';
import { Injectable } from '@nestjs/common';
import { format as dateFormat } from 'date-fns';
import type Logger from '@/misc/logger.js';
import { DriveService } from '@/core/DriveService.js';
import { createTemp } from '@/misc/create-temp.js';
import { UtilityService } from '@/core/UtilityService.js';
import { PrismaService } from '@/core/PrismaService.js';
import { QueueLoggerService } from '../QueueLoggerService.js';
import type * as Bull from 'bullmq';
import type { DbJobDataWithUser } from '../types.js';

@Injectable()
export class ExportBlockingProcessorService {
	private readonly logger: Logger;

	constructor(
		private readonly utilityService: UtilityService,
		private readonly driveService: DriveService,
		private readonly queueLoggerService: QueueLoggerService,
		private readonly prismaService: PrismaService,
	) {
		this.logger =
			this.queueLoggerService.logger.createSubLogger('export-blocking');
	}

	public async process(job: Bull.Job<DbJobDataWithUser>): Promise<void> {
		this.logger.info(`Exporting blocking of ${job.data.user.id} ...`);

		const user = await this.prismaService.client.user.findUnique({
			where: { id: job.data.user.id },
			include: {
				blocking_blocking_blockerIdTouser: {
					include: { user_blocking_blockeeIdTouser: true },
				},
			},
		});
		if (user == null) return;

		// Create temp file
		const [path, cleanup] = await createTemp();

		try {
			const content = user.blocking_blocking_blockerIdTouser
				.map((blocking) => {
					const user = blocking.user_blocking_blockeeIdTouser;
					return this.utilityService.getFullApAccount(user.username, user.host);
				})
				.map((entry) => entry + '\n')
				.join('');

			fs.writeFileSync(path, content);

			const fileName =
				'blocking-' + dateFormat(new Date(), 'yyyy-MM-dd-HH-mm-ss') + '.csv';
			const driveFile = await this.driveService.addFile({
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
