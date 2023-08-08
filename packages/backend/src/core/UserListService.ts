import { Injectable } from '@nestjs/common';
import type { User } from '@/models/entities/User.js';
import type { UserList } from '@/models/entities/UserList.js';
import { IdService } from '@/core/IdService.js';
import { GlobalEventService } from '@/core/GlobalEventService.js';
import { UserEntityService } from '@/core/entities/UserEntityService.js';
import { ProxyAccountService } from '@/core/ProxyAccountService.js';
import { bindThis } from '@/decorators.js';
import { RoleService } from '@/core/RoleService.js';
import { QueueService } from '@/core/QueueService.js';
import type { T2P } from '@/types.js';
import { PrismaService } from '@/core/PrismaService.js';
import type { user, user_list } from '@prisma/client';

@Injectable()
export class UserListService {
	public static TooManyUsersError = class extends Error {};

	constructor(
		private readonly userEntityService: UserEntityService,
		private readonly idService: IdService,
		private readonly roleService: RoleService,
		private readonly globalEventService: GlobalEventService,
		private readonly proxyAccountService: ProxyAccountService,
		private readonly queueService: QueueService,
		private readonly prismaService: PrismaService,
	) {}

	@bindThis
	public async push(target: T2P<User, user>, list: T2P<UserList, user_list>, me: T2P<User, user>) {
		const currentCount = await this.prismaService.client.user_list_joining.count({
			where: { userListId: list.id },
		});
		if (currentCount > (await this.roleService.getUserPolicies(me.id)).userEachUserListsLimit) {
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

		this.globalEventService.publishUserListStream(list.id, 'userAdded', await this.userEntityService.pack(target));

		// このインスタンス内にこのリモートユーザーをフォローしているユーザーがいなくても投稿を受け取るためにダミーのユーザーがフォローしたということにする
		if (this.userEntityService.isRemoteUser(target)) {
			const proxy = await this.proxyAccountService.fetch();
			if (proxy) {
				this.queueService.createFollowJob([{ from: { id: proxy.id }, to: { id: target.id } }]);
			}
		}
	}
}
