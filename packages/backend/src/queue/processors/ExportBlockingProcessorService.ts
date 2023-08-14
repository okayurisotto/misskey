import * as fs from 'node:fs';
import { Injectable } from '@nestjs/common';
import { format as dateFormat } from 'date-fns';
import type Logger from '@/logger.js';
import { DriveService } from '@/core/DriveService.js';
import { createTemp } from '@/misc/create-temp.js';
import { UtilityService } from '@/core/UtilityService.js';
import { bindThis } from '@/decorators.js';
import { PrismaService } from '@/core/PrismaService.js';
import { QueueLoggerService } from '../QueueLoggerService.js';
import type * as Bull from 'bullmq';
import type { DbJobDataWithUser } from '../types.js';
import type { blocking } from '@prisma/client';

@Injectable()
export class ExportBlockingProcessorService {
	private readonly logger: Logger;

	constructor(
		private readonly utilityService: UtilityService,
		private readonly driveService: DriveService,
		private readonly queueLoggerService: QueueLoggerService,
		private readonly prismaService: PrismaService,
	) {
		this.logger = this.queueLoggerService.logger.createSubLogger('export-blocking');
	}

	@bindThis
	public async process(job: Bull.Job<DbJobDataWithUser>): Promise<void> {
		this.logger.info(`Exporting blocking of ${job.data.user.id} ...`);

		const user = await this.prismaService.client.user.findUnique({ where: { id: job.data.user.id } });
		if (user == null) {
			return;
		}

		// Create temp file
		const [path, cleanup] = await createTemp();

		this.logger.info(`Temp file is ${path}`);

		try {
			const stream = fs.createWriteStream(path, { flags: 'a' });

			let exportedCount = 0;
			let cursor: blocking['id'] | null = null;

			while (true) {
				const blockings: blocking[] = await this.prismaService.client.blocking.findMany({
					where: {
						blockerId: user.id,
						...(cursor ? { id: { gt: cursor } } : {}),
					},
					take: 100,
					orderBy: { id: 'asc' },
				});

				if (blockings.length === 0) {
					job.updateProgress(100);
					break;
				}

				cursor = blockings.at(-1)?.id ?? null;

				for (const block of blockings) {
					const u = await this.prismaService.client.user.findUnique({ where: { id: block.blockeeId } });
					if (u == null) {
						exportedCount++; continue;
					}

					const content = this.utilityService.getFullApAccount(u.username, u.host);
					await new Promise<void>((res, rej) => {
						stream.write(content + '\n', err => {
							if (err) {
								this.logger.error(err);
								rej(err);
							} else {
								res();
							}
						});
					});
					exportedCount++;
				}

				const total = await this.prismaService.client.blocking.count({
					where: {
						blockerId: user.id,
					},
				});

				job.updateProgress(exportedCount / total);
			}

			stream.end();
			this.logger.succ(`Exported to: ${path}`);

			const fileName = 'blocking-' + dateFormat(new Date(), 'yyyy-MM-dd-HH-mm-ss') + '.csv';
			const driveFile = await this.driveService.addFile({ user, path, name: fileName, force: true, ext: 'csv' });

			this.logger.succ(`Exported to: ${driveFile.id}`);
		} finally {
			cleanup();
		}
	}
}
