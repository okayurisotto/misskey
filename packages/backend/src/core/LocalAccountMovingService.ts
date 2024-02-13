import { Injectable } from '@nestjs/common';
import { NODE_ENV } from '@/env.js';
import type { LocalUser, RemoteUser } from '@/models/entities/User.js';
import { GlobalEventService } from '@/core/GlobalEventService.js';
import { QueueService } from '@/core/QueueService.js';
import { RelayService } from '@/core/RelayService.js';
import { ApDeliverManagerService } from '@/core/activitypub/ApDeliverManagerService.js';
import { ApRendererService } from '@/core/activitypub/ApRendererService.js';
import { UserEntityService } from '@/core/entities/UserEntityService.js';
import { PrismaService } from '@/core/PrismaService.js';
import type { MeDetailedSchema } from '@/models/zod/MeDetailedSchema.js';
import { AccountMovingPostProcessService } from './AccountMovingPostProcessService.js';
import { UserEntityUtilService } from './entities/UserEntityUtilService.js';
import type { Prisma } from '@prisma/client';
import type { z } from 'zod';

@Injectable()
export class LocalAccountMovingService {
	constructor(
		private readonly accountMovingPostProcessService: AccountMovingPostProcessService,
		private readonly apDeliverManagerService: ApDeliverManagerService,
		private readonly apRendererService: ApRendererService,
		private readonly globalEventService: GlobalEventService,
		private readonly prismaService: PrismaService,
		private readonly queueService: QueueService,
		private readonly relayService: RelayService,
		private readonly userEntityService: UserEntityService,
		private readonly userEntityUtilService: UserEntityUtilService,
	) {}

	/**
	 * Move a local account to a new account.
	 *
	 * After delivering Move activity, its local followers unfollow the old account and then follow the new one.
	 */
	public async move(
		src: LocalUser,
		dst: LocalUser | RemoteUser,
	): Promise<z.infer<typeof MeDetailedSchema>> {
		const srcUri = this.userEntityUtilService.getUserUri(src);
		const dstUri = this.userEntityUtilService.getUserUri(dst);

		// add movedToUri to indicate that the user has moved
		const alsoKnownAsArray = src.alsoKnownAs?.split(',') ?? [];
		const update: Prisma.UserUncheckedUpdateInput = {
			alsoKnownAs: (alsoKnownAsArray.includes(dstUri)
				? alsoKnownAsArray
				: [...alsoKnownAsArray, dstUri]
			).join(','),
			movedToUri: dstUri,
			movedAt: new Date(),
		};
		await this.prismaService.client.user.update({
			where: { id: src.id },
			data: update,
		});
		Object.assign(src, update);

		const srcPerson = await this.apRendererService.renderPerson(src);
		const updateAct = this.apRendererService.addContext(
			this.apRendererService.renderUpdate(srcPerson, src),
		);
		await this.apDeliverManagerService.deliverToFollowers(src, updateAct);
		await this.relayService.deliverToRelays(src, updateAct);

		// Deliver Move activity to the followers of the old account
		const moveAct = this.apRendererService.addContext(
			this.apRendererService.renderMove(src, dst),
		);
		await this.apDeliverManagerService.deliverToFollowers(src, moveAct);

		// Publish meUpdated event
		const iObj = await this.userEntityService.packDetailedMe(src, {
			includeSecrets: true,
		});
		this.globalEventService.publishMainStream(src.id, 'meUpdated', iObj);

		// Unfollow after 24 hours
		const followings = await this.prismaService.client.following.findMany({
			where: { followerId: src.id },
		});
		await this.queueService.createDelayedUnfollowJob(
			followings.map((following) => ({
				from: { id: src.id },
				to: { id: following.followeeId },
			})),
			NODE_ENV === 'test' ? 10000 : 1000 * 60 * 60 * 24,
		);

		await this.accountMovingPostProcessService.process(src, dst);

		return iObj;
	}
}
