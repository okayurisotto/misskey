import { Injectable, Inject } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { AppLockService } from '@/core/AppLockService.js';
import { DI } from '@/di-symbols.js';
import { UserEntityService } from '@/core/entities/UserEntityService.js';
import { bindThis } from '@/decorators.js';
import { PrismaService } from '@/core/PrismaService.js';
import Chart from '../core.js';
import { ChartLoggerService } from '../ChartLoggerService.js';
import { name, schema } from './entities/per-user-following.js';
import type { KVs } from '../core.js';
import type { user } from '@prisma/client';

/**
 * ユーザーごとのフォローに関するチャート
 */
@Injectable()
// eslint-disable-next-line import/no-default-export
export default class PerUserFollowingChart extends Chart<typeof schema> {
	constructor(
		@Inject(DI.db)
		private readonly db: DataSource,

		private readonly appLockService: AppLockService,
		private readonly userEntityService: UserEntityService,
		private readonly chartLoggerService: ChartLoggerService,
		private readonly prismaService: PrismaService,
	) {
		super(db, (k) => appLockService.getChartInsertLock(k), chartLoggerService.logger, name, schema, true);
	}

	protected async tickMajor(group: string): Promise<Partial<KVs<typeof schema>>> {
		const [
			localFollowingsCount,
			localFollowersCount,
			remoteFollowingsCount,
			remoteFollowersCount,
		] = await Promise.all([
			this.prismaService.client.following.count({ where: { followerId: group, followeeHost: null } }),
			this.prismaService.client.following.count({ where: { followeeId: group, followerHost: null } }),
			this.prismaService.client.following.count({ where: { followerId: group, followeeHost: { not: null } } }),
			this.prismaService.client.following.count({ where: { followeeId: group, followerHost: { not: null } } }),
		]);

		return {
			'local.followings.total': localFollowingsCount,
			'local.followers.total': localFollowersCount,
			'remote.followings.total': remoteFollowingsCount,
			'remote.followers.total': remoteFollowersCount,
		};
	}

	protected async tickMinor(): Promise<Partial<KVs<typeof schema>>> {
		return {};
	}

	@bindThis
	public async update(follower: { id: user['id']; host: user['host']; }, followee: { id: user['id']; host: user['host']; }, isFollow: boolean): Promise<void> {
		const prefixFollower = this.userEntityService.isLocalUser(follower) ? 'local' : 'remote';
		const prefixFollowee = this.userEntityService.isLocalUser(followee) ? 'local' : 'remote';

		this.commit({
			[`${prefixFollower}.followings.total`]: isFollow ? 1 : -1,
			[`${prefixFollower}.followings.inc`]: isFollow ? 1 : 0,
			[`${prefixFollower}.followings.dec`]: isFollow ? 0 : 1,
		}, follower.id);
		this.commit({
			[`${prefixFollowee}.followers.total`]: isFollow ? 1 : -1,
			[`${prefixFollowee}.followers.inc`]: isFollow ? 1 : 0,
			[`${prefixFollowee}.followers.dec`]: isFollow ? 0 : 1,
		}, followee.id);
	}
}
