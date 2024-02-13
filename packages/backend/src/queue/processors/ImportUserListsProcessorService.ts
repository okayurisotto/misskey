import { Injectable } from '@nestjs/common';
import { z } from 'zod';
import { User, user_list } from '@prisma/client';
import * as Acct from '@/misc/acct.js';
import { RemoteUserResolveService } from '@/core/RemoteUserResolveService.js';
import { DownloadService } from '@/core/DownloadService.js';
import { UserListService } from '@/core/UserListService.js';
import { IdService } from '@/core/IdService.js';
import { UtilityService } from '@/core/UtilityService.js';
import { PrismaService } from '@/core/PrismaService.js';
import { unique } from '@/misc/prelude/array.js';
import { QueueLoggerService } from '../QueueLoggerService.js';
import type * as Bull from 'bullmq';
import type { DbUserImportJobData } from '../types.js';

export const ExportedUserListsSchema = z.array(
	z.tuple([z.string(), z.string()]),
);

const getUserFromAcct = (users: User[]) => {
	return (acct: Acct.Acct): User | undefined => {
		return users.find((user) => {
			if (user.usernameLower !== acct.username.toLowerCase()) {
				return false;
			}

			if (user.host !== acct.host) {
				return false;
			}

			return true;
		});
	};
};

@Injectable()
export class ImportUserListsProcessorService {
	private readonly logger;

	constructor(
		private readonly utilityService: UtilityService,
		private readonly idService: IdService,
		private readonly userListService: UserListService,
		private readonly remoteUserResolveService: RemoteUserResolveService,
		private readonly downloadService: DownloadService,
		private readonly queueLoggerService: QueueLoggerService,
		private readonly prismaService: PrismaService,
	) {
		this.logger =
			this.queueLoggerService.logger.createSubLogger('import-user-lists');
	}

	public async process(job: Bull.Job<DbUserImportJobData>): Promise<void> {
		const now = new Date();

		this.logger.info(`Importing user lists of ${job.data.user.id} ...`);

		const me = await this.prismaService.client.user.findUnique({
			where: { id: job.data.user.id },
			include: { userLists: { include: { user_list_joining: true } } },
		});
		if (me === null) return;

		const file = await this.prismaService.client.driveFile.findUnique({
			where: { id: job.data.fileId },
		});
		if (file === null) return;

		const csv = await this.downloadService.downloadTextFile(file.url);

		// CSVをパースし、`Map<user_list["name"], Acct.Acct[]>`にする

		const data = new Map(
			[
				...ExportedUserListsSchema.parse(
					csv
						.trim()
						.split('\n')
						.map((line) => line.split(',')),
				).reduce<Map<string, Set<string>>>((acc, [list, acct]) => {
					return acc.set(list, (acc.get(list) ?? new Set()).add(acct));
				}, new Map()),
			].map(([listName, users]) => {
				return [listName, [...users].map((acct) => Acct.parse(acct))];
			}),
		);

		// 足りない`user_list`を作る
		// 同じ名前の`user_list`がすでにあればそれを使うため新規作成はしない（この挙動どうなの？）

		const userListCreateManyData = [...data.keys()]
			.filter((listName) => {
				return me.userLists.every((list) => list.name !== listName);
			})
			.map((listName) => ({
				id: this.idService.genId(),
				createdAt: now,
				name: listName,
				userId: me.id,
			}));
		await this.prismaService.client.user_list.createMany({
			data: userListCreateManyData,
		});

		// 足りない`user`を解決しつつ全`user`を取得

		const allUsers = await Promise.all(
			unique([...data.values()].map((set) => [...set]).flat()).map(
				async ({ username, host }) => {
					const user = await this.prismaService.client.user.findFirst({
						where: {
							host:
								host === null || this.utilityService.isSelfHost(host)
									? null
									: this.utilityService.toPuny(host),
							usernameLower: username.toLowerCase(),
						},
					});
					if (user !== null) return user;

					return await this.remoteUserResolveService.resolveUser(
						username,
						host,
					);
				},
			),
		);

		// 既存の`user_list`をすべて取得

		const allLists = await this.prismaService.client.user_list.findMany({
			where: { userId: me.id },
			include: { user_list_joining: true },
		});
		const allListsByName = new Map(allLists.map((list) => [list.name, list]));

		// 足りない`user_list_joinging`を作る

		const joiningCreateManyData = [...data]
			.map<{ user: User; user_list: user_list }[]>(([listName, accts]) => {
				const user_list = allListsByName.get(listName);
				if (user_list === undefined) {
					// 取得もしくは作成していたはずの`user_list`がない
					throw new Error('Cannot find user list.');
				}

				const users = accts.map((acct) => {
					const user = getUserFromAcct(allUsers)(acct);
					if (user === undefined) {
						// 取得もしくは解決していたはずの`user`がない
						throw new Error('Cannot find user.');
					}
					return user;
				});

				return users
					.filter((user) => {
						// すでにある`user_list_joining`のすべてが当該`user`のものでない場合：足りていない
						return user_list.user_list_joining.every((joining) => {
							return joining.userId !== user.id;
						});
					})
					.map((user) => ({ user, user_list }));
			})
			.flat();

		await Promise.all(
			joiningCreateManyData.map(async ({ user: target, user_list }) => {
				await this.userListService.push(target, user_list, me);
			}),
		);

		this.logger.succ('Imported');
	}
}
