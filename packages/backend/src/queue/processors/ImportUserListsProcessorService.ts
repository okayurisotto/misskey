import { Injectable } from '@nestjs/common';
import type Logger from '@/logger.js';
import * as Acct from '@/misc/acct.js';
import { RemoteUserResolveService } from '@/core/RemoteUserResolveService.js';
import { DownloadService } from '@/core/DownloadService.js';
import { UserListService } from '@/core/UserListService.js';
import { IdService } from '@/core/IdService.js';
import { UtilityService } from '@/core/UtilityService.js';
import { bindThis } from '@/decorators.js';
import { PrismaService } from '@/core/PrismaService.js';
import { QueueLoggerService } from '../QueueLoggerService.js';
import type * as Bull from 'bullmq';
import type { DbUserImportJobData } from '../types.js';
import type { user } from '@prisma/client';

@Injectable()
export class ImportUserListsProcessorService {
	private readonly logger: Logger;

	constructor(
		private readonly utilityService: UtilityService,
		private readonly idService: IdService,
		private readonly userListService: UserListService,
		private readonly remoteUserResolveService: RemoteUserResolveService,
		private readonly downloadService: DownloadService,
		private readonly queueLoggerService: QueueLoggerService,
		private readonly prismaService: PrismaService,
	) {
		this.logger = this.queueLoggerService.logger.createSubLogger('import-user-lists');
	}

	@bindThis
	public async process(job: Bull.Job<DbUserImportJobData>): Promise<void> {
		this.logger.info(`Importing user lists of ${job.data.user.id} ...`);

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
				const listName = line.split(',')[0].trim();
				const { username, host } = Acct.parse(line.split(',')[1].trim());

				let list = await this.prismaService.client.user_list.findFirst({
					where: {
						userId: user.id,
						name: listName,
					},
				});

				if (list == null) {
					list = await this.prismaService.client.user_list.create({
						data: {
							id: this.idService.genId(),
							createdAt: new Date(),
							userId: user.id,
							name: listName,
						},
					});
				}

				let target: user | null = this.utilityService.isSelfHost(host!)
					? await this.prismaService.client.user.findFirst({
						where: {
							host: null,
							usernameLower: username.toLowerCase(),
						},
					})
					: await this.prismaService.client.user.findUnique({
						where: {
							usernameLower_host: {
								host: this.utilityService.toPuny(host!),
								usernameLower: username.toLowerCase(),
							},
						},
					});

				if (target == null) {
					target = await this.remoteUserResolveService.resolveUser(username, host);
				}

				if (await this.prismaService.client.user_list_joining.findFirst({ where: { userListId: list!.id, userId: target.id }}) != null) continue;

				this.userListService.push(target, list!, user);
			} catch (e) {
				this.logger.warn(`Error in line:${linenum} ${e}`);
			}
		}

		this.logger.succ('Imported');
	}
}
