import * as fs from 'node:fs';
import { Injectable } from '@nestjs/common';
import { format as dateFormat } from 'date-fns';
import type Logger from '@/misc/logger.js';
import { createTemp } from '@/misc/create-temp.js';
import { UtilityService } from '@/core/UtilityService.js';
import { PrismaService } from '@/core/PrismaService.js';
import { DriveFileAddService } from '@/core/DriveFileAddService.js';
import { QueueLoggerService } from '../QueueLoggerService.js';
import type * as Bull from 'bullmq';
import type { DbJobDataWithUser } from '../types.js';

@Injectable()
export class ExportMutingProcessorService {
	private readonly logger: Logger;

	constructor(
		private readonly utilityService: UtilityService,
		private readonly queueLoggerService: QueueLoggerService,
		private readonly prismaService: PrismaService,
		private readonly driveFileAddService: DriveFileAddService,
	) {
		this.logger =
			this.queueLoggerService.logger.createSubLogger('export-muting');
	}

	public async process(job: Bull.Job<DbJobDataWithUser>): Promise<void> {
		this.logger.info(`Exporting muting of ${job.data.user.id} ...`);

		const user = await this.prismaService.client.user.findUnique({
			where: { id: job.data.user.id },
			include: {
				muting_muting_muterIdTouser: {
					include: { mutee: true },
				},
			},
		});
		if (user === null) return;

		const content = user.muting_muting_muterIdTouser
			.map((mute) => {
				return this.utilityService.getFullApAccount(
					mute.mutee.username,
					mute.mutee.host,
				);
			})
			.map((entry) => entry + '\n')
			.join('');

		// Create temp file
		const [path, cleanup] = await createTemp();
		this.logger.info(`Temp file is ${path}`);

		try {
			fs.writeFileSync(path, content);

			this.logger.succ(`Exported to: ${path}`);

			const fileName =
				'mute-' + dateFormat(new Date(), 'yyyy-MM-dd-HH-mm-ss') + '.csv';
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
