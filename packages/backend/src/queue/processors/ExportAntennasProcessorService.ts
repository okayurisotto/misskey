import fs from 'node:fs';
import { Injectable } from '@nestjs/common';
import { format as DateFormat } from 'date-fns';
import type { user } from '@prisma/client';
import type { User } from '@/models/index.js';
import Logger from '@/logger.js';
import { DriveService } from '@/core/DriveService.js';
import { bindThis } from '@/decorators.js';
import { createTemp } from '@/misc/create-temp.js';
import { UtilityService } from '@/core/UtilityService.js';
import { PrismaService } from '@/core/PrismaService.js';
import type { T2P } from '@/types.js';
import { QueueLoggerService } from '../QueueLoggerService.js';
import type { DBExportAntennasData } from '../types.js';
import type * as Bull from 'bullmq';

@Injectable()
export class ExportAntennasProcessorService {
	private readonly logger: Logger;

	constructor (
		private readonly driveService: DriveService,
		private readonly utilityService: UtilityService,
		private readonly queueLoggerService: QueueLoggerService,
		private readonly prismaService: PrismaService,
	) {
		this.logger = this.queueLoggerService.logger.createSubLogger('export-antennas');
	}

	@bindThis
	public async process(job: Bull.Job<DBExportAntennasData>): Promise<void> {
		const user = await this.prismaService.client.user.findUnique({ where: { id: job.data.user.id } });
		if (user == null) {
			return;
		}
		const [path, cleanup] = await createTemp();
		const stream = fs.createWriteStream(path, { flags: 'a' });
		const write = (input: string): Promise<void> => {
			return new Promise((resolve, reject) => {
				stream.write(input, err => {
					if (err) {
						this.logger.error(err);
						reject();
					} else {
						resolve();
					}
				});
			});
		};
		try {
			const antennas = await this.prismaService.client.antenna.findMany({ where: { userId: job.data.user.id } });
			write('[');
			for (const [index, antenna] of antennas.entries()) {
				let users: T2P<User, user>[] | undefined;
				if (antenna.userListId !== null) {
					const joinings = await this.prismaService.client.user_list_joining.findMany({ where: { userListId: antenna.userListId } });
					users = await this.prismaService.client.user.findMany({
						where: {
							id: { in: joinings.map(j => j.userId) },
						},
					});
				}
				write(JSON.stringify({
					name: antenna.name,
					src: antenna.src,
					keywords: antenna.keywords,
					excludeKeywords: antenna.excludeKeywords,
					users: antenna.users,
					userListAccts: typeof users !== 'undefined' ? users.map((u) => {
						return this.utilityService.getFullApAccount(u.username, u.host); // acct
					}) : null,
					caseSensitive: antenna.caseSensitive,
					withReplies: antenna.withReplies,
					withFile: antenna.withFile,
					notify: antenna.notify,
				}));
				if (antennas.length - 1 !== index) {
					write(', ');
				}
			}
			write(']');
			stream.end();

			const fileName = 'antennas-' + DateFormat(new Date(), 'yyyy-MM-dd-HH-mm-ss') + '.json';
			const driveFile = await this.driveService.addFile({ user, path, name: fileName, force: true, ext: 'json' });
			this.logger.succ('Exported to: ' + driveFile.id);
		} finally {
			cleanup();
		}
	}
}
