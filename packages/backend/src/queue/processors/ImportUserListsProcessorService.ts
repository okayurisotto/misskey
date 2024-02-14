import { Injectable } from '@nestjs/common';
import { z } from 'zod';
import { User, user_list } from '@prisma/client';
import { AcctFactory } from '@/factories/AcctFactory.js';
import { AcctEntity } from '@/entities/AcctEntity.js';
import { RemoteUserResolveService } from '@/core/RemoteUserResolveService.js';
import { DownloadService } from '@/core/DownloadService.js';
import { UserListService } from '@/core/UserListService.js';
import { IdService } from '@/core/IdService.js';
import { PrismaService } from '@/core/PrismaService.js';
import { unique } from '@/misc/prelude/array.js';
import { isNotNull } from '@/misc/is-not-null.js';
import { QueueLoggerService } from '../QueueLoggerService.js';
import type * as Bull from 'bullmq';
import type { DbUserImportJobData } from '../types.js';

export const ExportedUserListsSchema = z.array(
	z.tuple([z.string(), z.string()]),
);

@Injectable()
export class ImportUserListsProcessorService {
	private readonly logger;

	constructor(
		private readonly idService: IdService,
		private readonly userListService: UserListService,
		private readonly remoteUserResolveService: RemoteUserResolveService,
		private readonly downloadService: DownloadService,
		private readonly queueLoggerService: QueueLoggerService,
		private readonly prismaService: PrismaService,
		private readonly acctFactory: AcctFactory,
	) {
		this.logger =
			this.queueLoggerService.logger.createSubLogger('import-user-lists');
	}

	private getUserFromAcct(users: User[], acct: AcctEntity): User | undefined {
		return users.find((user) => {
			if (user.usernameLower !== acct.username.toLowerCase()) {
				return false;
			}

			if (acct.isLocal()) {
				if (user.host !== null) return false;
			} else {
				if (user.host !== acct.host.toASCII()) return false;
			}

			return true;
		});
	}

	public async process(job: Bull.Job<DbUserImportJobData>): Promise<void> {
		this.logger.info(`Importing user lists of ${job.data.user.id} ...`);

		// 準備 //

		const now = new Date();

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

		// CSVをパースする //

		const data = ((): Map<string, Set<AcctEntity>> => {
			const lines = csv
				.trim()
				.split('\n')
				.map((line) => line.split(','));

			const entries = ExportedUserListsSchema.parse(lines);

			return entries.reduce((acc, [listName, acct]) => {
				const prevItems = acc.get(listName);
				const defaultItems = new Set<AcctEntity>();
				const item = this.acctFactory.parse(acct);

				return acc.set(listName, (prevItems ?? defaultItems).add(item));
			}, new Map<string, Set<AcctEntity>>());
		})();

		// 足りないユーザーリストを新規に作成する //

		{
			const allListNames = new Set(me.userLists.map((list) => list.name));

			const userListCreateManyData = [...data.keys()]
				.filter((listName) => {
					// 同じ名前の`user_list`がすでにあればそれを使うため新規作成はしない
					return !allListNames.has(listName);
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
		}

		// 一旦すべてのユーザーを取得・解決する //

		const allUsers = await (async (): Promise<User[]> => {
			// 準備 //

			const allAccts = unique([...data.values()].flatMap((set) => [...set]));

			// すべてのユーザーについてダメ元でデータベースに一括で問い合わせる //

			const dbUsers = await this.prismaService.client.user.findMany({
				where: { OR: allAccts.map((acct) => acct.whereUser()) },
			});

			// すべてのユーザーを取得・解決する //

			const users = await Promise.all(
				allAccts.map(async (acct) => {
					const user = this.getUserFromAcct(dbUsers, acct);
					if (user !== undefined) {
						// すでにデータベースにユーザーが存在するなら御の字
						return user;
					} else {
						// データベースにないということは未解決のリモートユーザーということなので解決する
						return await this.remoteUserResolveService.resolveUser(
							acct.username,
							acct.host.toASCII(),
						);
					}
				}),
			);

			// 完了 //

			return users;
		})();

		// 既存のユーザーリストを（先程新規に作成した分も含めて）すべて取得する //

		const allLists = await this.prismaService.client.user_list.findMany({
			where: { userId: me.id },
			include: { user_list_joining: true },
		});

		const allListsByName = new Map(
			allLists.map((list) => {
				// 同じ名前のユーザーリストが複数あった場合、いずれかが選ばれる
				// どのユーザーリストが選ばれるかはデータベースからの取得順による
				// （データベースからの取得順（`orderBy`）は未定義）
				return [list.name, list];
			}),
		);

		// 足りない`user_list_joinging`を作る //

		const joiningCreateManyData = [...data]
			.flatMap(([listName, accts]) => {
				return [...accts].map((acct) => [listName, acct] as const);
			})
			.map<{ user: User; user_list: user_list } | null>(([listName, acct]) => {
				const user_list = allListsByName.get(listName);
				if (user_list === undefined) {
					// 取得もしくは作成していたはずのユーザーリストがない
					throw new Error('Cannot find user list.');
				}

				const user = this.getUserFromAcct(allUsers, acct);
				if (user === undefined) {
					// 取得もしくは解決していたはずのユーザーがない
					throw new Error('Cannot find user.');
				}

				const alreadyExist = user_list.user_list_joining.some((joining) => {
					return joining.userId === user.id;
				});
				if (alreadyExist) {
					// nothing to do
					return null;
				}

				return { user, user_list };
			})
			.filter(isNotNull);

		await Promise.all(
			joiningCreateManyData.map(async ({ user: target, user_list }) => {
				await this.userListService.push(target, user_list, me);
			}),
		);

		// 完了 //

		this.logger.succ('Imported');
	}
}
