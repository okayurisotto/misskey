import { Injectable } from '@nestjs/common';
import { UserFollowingService } from '@/core/UserFollowingService.js';
import { UserBlockingService } from '@/core/UserBlockingService.js';
import { bindThis } from '@/decorators.js';
import type Logger from '@/misc/logger.js';
import { LocalUser, RemoteUser } from '@/models/entities/User.js';
import { PrismaService } from '@/core/PrismaService.js';
import { RelationshipJobData } from '../types.js';
import { QueueLoggerService } from '../QueueLoggerService.js';
import type * as Bull from 'bullmq';

@Injectable()
export class RelationshipProcessorService {
	private readonly logger: Logger;

	constructor(
		private readonly queueLoggerService: QueueLoggerService,
		private readonly userFollowingService: UserFollowingService,
		private readonly userBlockingService: UserBlockingService,
		private readonly prismaService: PrismaService,
	) {
		this.logger = this.queueLoggerService.logger.createSubLogger('follow-block');
	}

	@bindThis
	public async processFollow(job: Bull.Job<RelationshipJobData>): Promise<string> {
		this.logger.info(`${job.data.from.id} is trying to follow ${job.data.to.id}`);
		await this.userFollowingService.follow(job.data.from, job.data.to, job.data.requestId, job.data.silent);
		return 'ok';
	}

	@bindThis
	public async processUnfollow(job: Bull.Job<RelationshipJobData>): Promise<string> {
		this.logger.info(`${job.data.from.id} is trying to unfollow ${job.data.to.id}`);
		const [follower, followee] = await Promise.all([
			this.prismaService.client.user.findUniqueOrThrow({ where: { id: job.data.from.id } }),
			this.prismaService.client.user.findUniqueOrThrow({ where: { id: job.data.to.id } }),
		]) as [LocalUser | RemoteUser, LocalUser | RemoteUser];
		await this.userFollowingService.unfollow(follower, followee, job.data.silent);
		return 'ok';
	}

	@bindThis
	public async processBlock(job: Bull.Job<RelationshipJobData>): Promise<string> {
		this.logger.info(`${job.data.from.id} is trying to block ${job.data.to.id}`);
		const [blockee, blocker] = await Promise.all([
			this.prismaService.client.user.findUniqueOrThrow({ where: { id: job.data.from.id } }),
			this.prismaService.client.user.findUniqueOrThrow({ where: { id: job.data.to.id } }),
		]);
		await this.userBlockingService.block(blockee, blocker, job.data.silent);
		return 'ok';
	}

	@bindThis
	public async processUnblock(job: Bull.Job<RelationshipJobData>): Promise<string> {
		this.logger.info(`${job.data.from.id} is trying to unblock ${job.data.to.id}`);
		const [blockee, blocker] = await Promise.all([
			this.prismaService.client.user.findUniqueOrThrow({ where: { id: job.data.from.id } }),
			this.prismaService.client.user.findUniqueOrThrow({ where: { id: job.data.to.id } }),
		]);
		await this.userBlockingService.unblock(blockee, blocker);
		return 'ok';
	}
}
