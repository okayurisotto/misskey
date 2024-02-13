import { Injectable } from '@nestjs/common';
import { IdService } from '@/core/IdService.js';
import { GlobalEventService } from '@/core/GlobalEventService.js';
import { ProxyAccountService } from '@/core/ProxyAccountService.js';
import { RoleService } from '@/core/RoleService.js';
import { QueueService } from '@/core/QueueService.js';
import { PrismaService } from '@/core/PrismaService.js';
import { UserEntityUtilService } from './entities/UserEntityUtilService.js';
import { UserEntityPackLiteService } from './entities/UserEntityPackLiteService.js';
import type { User, user_list } from '@prisma/client';

@Injectable()
export class UserListService {
	public static TooManyUsersError = class extends Error {};

	constructor(
		private readonly idService: IdService,
		private readonly roleService: RoleService,
		private readonly globalEventService: GlobalEventService,
		private readonly proxyAccountService: ProxyAccountService,
		private readonly queueService: QueueService,
		private readonly prismaService: PrismaService,
		private readonly userEntityUtilService: UserEntityUtilService,
		private readonly userEntityPackLiteService: UserEntityPackLiteService,
	) {}

	public async push(target: User, list: user_list, me: User): Promise<void> {
		const currentCount =
			await this.prismaService.client.user_list_joining.count({
				where: { userListId: list.id },
			});
		const policies = await this.roleService.getUserPolicies(me.id);

		if (currentCount > policies.userEachUserListsLimit) {
			throw new UserListService.TooManyUsersError();
		}

		await this.prismaService.client.user_list_joining.create({
			data: {
				id: this.idService.genId(),
				createdAt: new Date(),
				userId: target.id,
				userListId: list.id,
			},
		});

		this.globalEventService.publishUserListStream(
			list.id,
			'userAdded',
			await this.userEntityPackLiteService.packLite(target),
		);

		// このインスタンス内にそのリモートユーザーをフォローしているユーザーがいなかった場合、投稿を受け取るためにダミーのユーザーがフォローしたということにする
		if (this.userEntityUtilService.isRemoteUser(target)) {
			const proxy = await this.proxyAccountService.fetch();
			if (proxy) {
				await this.queueService.createFollowJob([
					{ from: { id: proxy.id }, to: { id: target.id } },
				]);
			}
		}
	}
}
