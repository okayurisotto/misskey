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
export class ExportUserListsProcessorService {
	private readonly logger;

	constructor(
		private readonly queueLoggerService: QueueLoggerService,
		private readonly prismaService: PrismaService,
		private readonly driveFileAddService: DriveFileAddService,
		private readonly acctFactory: AcctFactory,
	) {
		this.logger =
			this.queueLoggerService.logger.createSubLogger('export-user-lists');
	}

	public async process(job: Bull.Job<DbJobDataWithUser>): Promise<void> {
		this.logger.info(`Exporting user lists of ${job.data.user.id} ...`);

		const user = await this.prismaService.client.user.findUnique({
			where: { id: job.data.user.id },
			include: {
				userLists: {
					include: { user_list_joining: { include: { user: true } } },
				},
			},
		});
		if (user === null) return;

		const content = user.userLists
			.flatMap((list) => {
				return list.user_list_joining
					.map(({ user }) => {
						return this.acctFactory
							.create(user.username, user.host)
							.formatLong();
					})
					.map((acct) => [list.name, acct].join(','));
			})
			.map((entry) => entry + '\n')
			.join('');

		// Create temp file

		const [path, cleanup] = await createTemp();
		this.logger.info(`Temp file is ${path}`);

		fs.writeFileSync(path, content);
		this.logger.succ(`Exported to: ${path}`);

		const fileName =
			'user-lists-' + dateFormat(new Date(), 'yyyy-MM-dd-HH-mm-ss') + '.csv';
		const driveFile = await this.driveFileAddService.add({
			user,
			path,
			name: fileName,
			force: true,
			ext: 'csv',
		});

		this.logger.succ(`Exported to: ${driveFile.id}`);

		cleanup();
	}
}
