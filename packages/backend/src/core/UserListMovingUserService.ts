import { Injectable } from '@nestjs/common';
import type { ThinUser } from '@/queue/types.js';
import { IdService } from '@/core/IdService.js';
import { QueueService } from '@/core/QueueService.js';
import { ProxyAccountService } from '@/core/ProxyAccountService.js';
import { PrismaService } from '@/core/PrismaService.js';
import { UserEntityUtilService } from './entities/UserEntityUtilService.js';
import type { Prisma, User } from '@prisma/client';

@Injectable()
export class UserListMovingUserService {
	constructor(
		private readonly idService: IdService,
		private readonly proxyAccountService: ProxyAccountService,
		private readonly queueService: QueueService,
		private readonly prismaService: PrismaService,
		private readonly userEntityUtilService: UserEntityUtilService,
	) {}

	/**
	 * Update lists while moving accounts.
	 *   - No removal of the old account from the lists
	 *   - Users number limit is not checked
	 *
	 * @param src ThinUser (old account)
	 * @param dst User (new account)
	 * @returns {Promise<void>}
	 */
	public async move(src: ThinUser, dst: User): Promise<void> {
		const dstJoinings =
			await this.prismaService.client.user_list_joining.findMany({
				where: { userId: dst.id },
			});

		const srcJoinings =
			await this.prismaService.client.user_list_joining.findMany({
				where: {
					userId: src.id,
					userListId: {
						notIn: dstJoinings.map(({ userListId }) => userListId),
					}, // skip
				},
			});
		if (srcJoinings.length === 0) return;

		const newJoinings = new Map<
			string,
			Omit<Prisma.user_list_joiningCreateManyInput, 'id'>
		>();

		// 重複しないようにIDを生成
		const genId = (): string => {
			let id: string;
			do {
				id = this.idService.genId();
			} while (newJoinings.has(id));
			return id;
		};
		for (const joining of srcJoinings) {
			newJoinings.set(genId(), {
				createdAt: new Date(),
				userId: dst.id,
				userListId: joining.userListId,
			});
		}

		const arrayToInsert: Prisma.user_list_joiningCreateManyInput[] = [
			...newJoinings,
		].map((entry) => ({
			...entry[1],
			id: entry[0],
		}));
		await this.prismaService.client.user_list_joining.createMany({
			data: arrayToInsert,
		});

		// Have the proxy account follow the new account in the same way as UserListService.push
		if (this.userEntityUtilService.isRemoteUser(dst)) {
			const proxy = await this.proxyAccountService.fetch();
			if (proxy) {
				await this.queueService.createFollowJob([
					{ from: { id: proxy.id }, to: { id: dst.id } },
				]);
			}
		}
	}
}
