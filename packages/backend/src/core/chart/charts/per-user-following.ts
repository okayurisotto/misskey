import { Injectable } from '@nestjs/common';
import { AppLockService } from '@/core/AppLockService.js';
import { PrismaService } from '@/core/PrismaService.js';
import { TypeORMService } from '@/core/TypeORMService.js';
import { UserEntityUtilService } from '@/core/entities/UserEntityUtilService.js';
import Chart from '../core.js';
import { ChartLoggerService } from '../ChartLoggerService.js';
import { name, schema } from './entities/per-user-following.js';
import type { KVs } from '../core.js';
import type { User } from '@prisma/client';

/**
 * ユーザーごとのフォローに関するチャート
 */
@Injectable()
// eslint-disable-next-line import/no-default-export
export default class PerUserFollowingChart extends Chart<typeof schema> {
	constructor(
		db: TypeORMService,
		appLockService: AppLockService,
		chartLoggerService: ChartLoggerService,

		private readonly prismaService: PrismaService,
		private readonly userEntityUtilService: UserEntityUtilService,
	) {
		super(
			db,
			(k) => appLockService.getChartInsertLock(k),
			chartLoggerService.logger,
			name,
			schema,
			true,
		);
	}

	protected async tickMajor(
		group: string,
	): Promise<Partial<KVs<typeof schema>>> {
		const [
			localFollowingsCount,
			localFollowersCount,
			remoteFollowingsCount,
			remoteFollowersCount,
		] = await Promise.all([
			this.prismaService.client.following.count({
				where: { followerId: group, followee: { host: null } },
			}),
			this.prismaService.client.following.count({
				where: { followeeId: group, follower: { host: null } },
			}),
			this.prismaService.client.following.count({
				where: { followerId: group, followee: { host: { not: null } } },
			}),
			this.prismaService.client.following.count({
				where: { followeeId: group, follower: { host: { not: null } } },
			}),
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

	public async update(
		follower: { id: User['id']; host: User['host'] },
		followee: { id: User['id']; host: User['host'] },
		isFollow: boolean,
	): Promise<void> {
		const prefixFollower = this.userEntityUtilService.isLocalUser(follower)
			? 'local'
			: 'remote';
		const prefixFollowee = this.userEntityUtilService.isLocalUser(followee)
			? 'local'
			: 'remote';

		this.commit(
			{
				[`${prefixFollower}.followings.total`]: isFollow ? 1 : -1,
				[`${prefixFollower}.followings.inc`]: isFollow ? 1 : 0,
				[`${prefixFollower}.followings.dec`]: isFollow ? 0 : 1,
			},
			follower.id,
		);
		this.commit(
			{
				[`${prefixFollowee}.followers.total`]: isFollow ? 1 : -1,
				[`${prefixFollowee}.followers.inc`]: isFollow ? 1 : 0,
				[`${prefixFollowee}.followers.dec`]: isFollow ? 0 : 1,
			},
			followee.id,
		);
	}
}
