import { Injectable } from '@nestjs/common';
import { LocalUser, RemoteUser } from '@/models/entities/User.js';
import { PrismaService } from '@/core/PrismaService.js';
import { UserFollowingCreateService } from '@/core/UserFollowingCreateService.js';
import { UserFollowingDeleteService } from '@/core/UserFollowingDeleteService.js';
import { UserBlockingCreateService } from '@/core/UserBlockingCreateService.js';
import { UserBlockingDeleteService } from '@/core/UserBlockingDeleteService.js';
import { RelationshipJobData } from '../types.js';
import { QueueLoggerService } from '../QueueLoggerService.js';
import type * as Bull from 'bullmq';

@Injectable()
export class RelationshipProcessorService {
	private readonly logger;

	constructor(
		private readonly queueLoggerService: QueueLoggerService,
		private readonly prismaService: PrismaService,
		private readonly userFollowingCreateService: UserFollowingCreateService,
		private readonly userFollowingDeleteService: UserFollowingDeleteService,
		private readonly userBlockingCreateService: UserBlockingCreateService,
		private readonly userBlockingDeleteService: UserBlockingDeleteService,
	) {
		this.logger =
			this.queueLoggerService.logger.createSubLogger('follow-block');
	}

	public async processFollow(
		job: Bull.Job<RelationshipJobData>,
	): Promise<string> {
		this.logger.info(
			`${job.data.from.id} is trying to follow ${job.data.to.id}`,
		);
		await this.userFollowingCreateService.create(
			job.data.from,
			job.data.to,
			job.data.requestId,
			job.data.silent,
		);
		return 'ok';
	}

	public async processUnfollow(
		job: Bull.Job<RelationshipJobData>,
	): Promise<string> {
		this.logger.info(
			`${job.data.from.id} is trying to unfollow ${job.data.to.id}`,
		);
		const [follower, followee] = (await Promise.all([
			this.prismaService.client.user.findUniqueOrThrow({
				where: { id: job.data.from.id },
			}),
			this.prismaService.client.user.findUniqueOrThrow({
				where: { id: job.data.to.id },
			}),
		])) as [LocalUser | RemoteUser, LocalUser | RemoteUser];
		await this.userFollowingDeleteService.delete(
			follower,
			followee,
			job.data.silent,
		);
		return 'ok';
	}

	public async processBlock(
		job: Bull.Job<RelationshipJobData>,
	): Promise<string> {
		this.logger.info(
			`${job.data.from.id} is trying to block ${job.data.to.id}`,
		);
		const [blockee, blocker] = await Promise.all([
			this.prismaService.client.user.findUniqueOrThrow({
				where: { id: job.data.from.id },
			}),
			this.prismaService.client.user.findUniqueOrThrow({
				where: { id: job.data.to.id },
			}),
		]);
		await this.userBlockingCreateService.create(
			blockee,
			blocker,
			job.data.silent,
		);
		return 'ok';
	}

	public async processUnblock(
		job: Bull.Job<RelationshipJobData>,
	): Promise<string> {
		this.logger.info(
			`${job.data.from.id} is trying to unblock ${job.data.to.id}`,
		);
		const [blockee, blocker] = await Promise.all([
			this.prismaService.client.user.findUniqueOrThrow({
				where: { id: job.data.from.id },
			}),
			this.prismaService.client.user.findUniqueOrThrow({
				where: { id: job.data.to.id },
			}),
		]);
		await this.userBlockingDeleteService.delete(blockee, blocker);
		return 'ok';
	}
}
