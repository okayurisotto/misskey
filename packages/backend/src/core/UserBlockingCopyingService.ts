import { Injectable } from '@nestjs/common';
import type { RelationshipJobData, ThinUser } from '@/queue/types.js';
import { QueueService } from '@/core/QueueService.js';
import { PrismaService } from '@/core/PrismaService.js';

@Injectable()
export class UserBlockingCopyingService {
	constructor(
		private readonly queueService: QueueService,
		private readonly prismaService: PrismaService,
	) {}

	public async copy(src: ThinUser, dst: ThinUser): Promise<void> {
		// Followers shouldn't overlap with blockers, but the destination account, different from the blockee (i.e., old account), may have followed the local user before moving.
		// So block the destination account here.

		const dstBlockings = await this.prismaService.client.blocking.findMany({
			where: { blockeeId: dst.id },
		});
		const srcBlockings = await this.prismaService.client.blocking.findMany({
			where: {
				blockeeId: src.id,
				blockerId: { notIn: dstBlockings.map(({ blockerId }) => blockerId) }, // skip
			},
		});

		// reblock the destination account
		const blockJobs = srcBlockings.map<RelationshipJobData>((srcBlocking) => ({
			from: { id: srcBlocking.blockerId },
			to: { id: dst.id },
		}));

		await this.queueService.createBlockJob(blockJobs);

		// no need to unblock the old account because it may be still functional
	}
}
