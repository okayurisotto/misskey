import fs from 'node:fs';
import { Injectable } from '@nestjs/common';
import { format as DateFormat } from 'date-fns';
import { z } from 'zod';
import { pick } from 'omick';
import { createTemp } from '@/misc/create-temp.js';
import { PrismaService } from '@/core/PrismaService.js';
import type { ExportedAntennaSchema } from '@/models/zod/ExportedAntennaSchema.js';
import { DriveFileAddService } from '@/core/DriveFileAddService.js';
import { AcctFactory } from '@/factories/AcctFactory.js';
import { QueueLoggerService } from '../QueueLoggerService.js';
import type { DBExportAntennasData } from '../types.js';
import type * as Bull from 'bullmq';

@Injectable()
export class ExportAntennasProcessorService {
	private readonly logger;

	constructor(
		private readonly queueLoggerService: QueueLoggerService,
		private readonly prismaService: PrismaService,
		private readonly driveFileAddService: DriveFileAddService,
		private readonly acctFactory: AcctFactory,
	) {
		this.logger =
			this.queueLoggerService.logger.createSubLogger('export-antennas');
	}

	public async process(job: Bull.Job<DBExportAntennasData>): Promise<void> {
		const user = await this.prismaService.client.user.findUnique({
			where: { id: job.data.user.id },
			include: {
				antennas: {
					include: {
						userList: {
							include: { user_list_joining: { include: { user: true } } },
						},
					},
				},
			},
		});
		if (user === null) return;

		const [path, cleanup] = await createTemp();

		try {
			const data = user.antennas.map<z.infer<typeof ExportedAntennaSchema>>(
				(antenna) => {
					const userListAccts =
						antenna.userList?.user_list_joining.map(({ user }) => {
							return this.acctFactory
								.create(user.username, user.host)
								.formatLong();
						}) ?? null;

					return {
						...pick(antenna, [
							'name',
							'src',
							'users',
							'caseSensitive',
							'withReplies',
							'withFile',
							'notify',
						]),
						userListAccts,
						keywords: z.array(z.array(z.string())).parse(antenna.keywords),
						excludeKeywords: z
							.array(z.array(z.string()))
							.parse(antenna.excludeKeywords),
					};
				},
			);

			fs.writeFileSync(path, JSON.stringify(data));

			const fileName =
				'antennas-' + DateFormat(new Date(), 'yyyy-MM-dd-HH-mm-ss') + '.json';
			const driveFile = await this.driveFileAddService.add({
				user,
				path,
				name: fileName,
				force: true,
				ext: 'json',
			});
			this.logger.succ('Exported to: ' + driveFile.id);
		} finally {
			cleanup();
		}
	}
}
