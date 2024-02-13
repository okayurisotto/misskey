import { Injectable } from '@nestjs/common';
import type { LocalUser, RemoteUser } from '@/models/entities/User.js';
import { IdentifiableError } from '@/misc/identifiable-error.js';
import { QueueService } from '@/core/QueueService.js';
import { ApRendererService } from '@/core/activitypub/ApRendererService.js';
import { PrismaService } from '@/core/PrismaService.js';
import { AlsoKnownAsValidationService } from './AlsoKnownAsValidationService.js';
import { UserFollowRequestCreateService } from './UserFollowRequestCreateService.js';
import { UserFollowingCreateProcessService } from './UserFollowingCreateProcessService.js';
import { UserBlockingDeleteService } from './UserBlockingDeleteService.js';
import { UserBlockingCheckService } from './UserBlockingCheckService.js';
import { UserEntityUtilService } from './entities/UserEntityUtilService.js';
import type { User } from '@prisma/client';

@Injectable()
export class UserFollowingCreateService {
	constructor(
		private readonly alsoKnownAsValidationService: AlsoKnownAsValidationService,
		private readonly apRendererService: ApRendererService,
		private readonly prismaService: PrismaService,
		private readonly queueService: QueueService,
		private readonly userFollowingCreateProcessService: UserFollowingCreateProcessService,
		private readonly userFollowRequestCreateService: UserFollowRequestCreateService,
		private readonly userBlockingDeleteService: UserBlockingDeleteService,
		private readonly userBlockingCheckService: UserBlockingCheckService,
		private readonly userEntityUtilService: UserEntityUtilService,
	) {}

	public async create(
		_follower: { id: User['id'] },
		_followee: { id: User['id'] },
		requestId?: string,
		silent = false,
	): Promise<void> {
		const [follower, followee] = (await Promise.all([
			this.prismaService.client.user.findUniqueOrThrow({
				where: { id: _follower.id },
			}),
			this.prismaService.client.user.findUniqueOrThrow({
				where: { id: _followee.id },
			}),
		])) as [LocalUser | RemoteUser, LocalUser | RemoteUser];

		// check blocking
		const [blocking, blocked] = await Promise.all([
			this.userBlockingCheckService.check(follower.id, followee.id),
			this.userBlockingCheckService.check(followee.id, follower.id),
		]);

		if (
			this.userEntityUtilService.isRemoteUser(follower) &&
			this.userEntityUtilService.isLocalUser(followee) &&
			blocked
		) {
			// リモートフォローを受けてブロックしていた場合は、エラーにするのではなくRejectを送り返しておしまい。
			const content = this.apRendererService.addContext(
				this.apRendererService.renderReject(
					this.apRendererService.renderFollow(follower, followee, requestId),
					followee,
				),
			);
			this.queueService.deliver(followee, content, follower.inbox, false);
			return;
		} else if (
			this.userEntityUtilService.isRemoteUser(follower) &&
			this.userEntityUtilService.isLocalUser(followee) &&
			blocking
		) {
			// リモートフォローを受けてブロックされているはずの場合だったら、ブロック解除しておく。
			await this.userBlockingDeleteService.delete(follower, followee);
		} else {
			// それ以外は単純に例外
			if (blocking)
				throw new IdentifiableError(
					'710e8fb0-b8c3-4922-be49-d5d93d8e6a6e',
					'blocking',
				);
			if (blocked)
				throw new IdentifiableError(
					'3338392a-f764-498d-8855-db939dcf8c48',
					'blocked',
				);
		}

		const followeeProfile =
			await this.prismaService.client.user_profile.findUniqueOrThrow({
				where: { userId: followee.id },
			});

		// フォロー対象が鍵アカウントである or
		// フォロワーがBotであり、フォロー対象がBotからのフォローに慎重である or
		// フォロワーがローカルユーザーであり、フォロー対象がリモートユーザーである
		// 上記のいずれかに当てはまる場合はすぐフォローせずにフォローリクエストを発行しておく
		if (
			followee.isLocked ||
			(followeeProfile.carefulBot && follower.isBot) ||
			(this.userEntityUtilService.isLocalUser(follower) &&
				this.userEntityUtilService.isRemoteUser(followee))
		) {
			let autoAccept = false;

			// 鍵アカウントであっても、既にフォローされていた場合はスルー
			const isFollowing = await this.prismaService.client.following
				.count({
					where: {
						followerId: follower.id,
						followeeId: followee.id,
					},
					take: 1,
				})
				.then((count) => count > 0);
			if (isFollowing) {
				autoAccept = true;
			}

			// フォローしているユーザーは自動承認オプション
			if (
				!autoAccept &&
				this.userEntityUtilService.isLocalUser(followee) &&
				followeeProfile.autoAcceptFollowed
			) {
				const isFollowed =
					(await this.prismaService.client.following.count({
						where: {
							followerId: followee.id,
							followeeId: follower.id,
						},
						take: 1,
					})) > 0;

				if (isFollowed) autoAccept = true;
			}

			// Automatically accept if the follower is an account who has moved and the locked followee had accepted the old account.
			if (followee.isLocked && !autoAccept) {
				autoAccept = !!(await this.alsoKnownAsValidationService.validate(
					follower,
					async (oldSrc, newSrc) =>
						(await this.prismaService.client.following.count({
							where: {
								followeeId: followee.id,
								followerId: newSrc.id,
							},
							take: 1,
						})) > 0,
					true,
				));
			}

			if (!autoAccept) {
				await this.userFollowRequestCreateService.create(
					follower,
					followee,
					requestId,
				);
				return;
			}
		}

		await this.userFollowingCreateProcessService.process(
			followee,
			follower,
			silent,
		);

		if (
			this.userEntityUtilService.isRemoteUser(follower) &&
			this.userEntityUtilService.isLocalUser(followee)
		) {
			const content = this.apRendererService.addContext(
				this.apRendererService.renderAccept(
					this.apRendererService.renderFollow(follower, followee, requestId),
					followee,
				),
			);
			this.queueService.deliver(followee, content, follower.inbox, false);
		}
	}
}
