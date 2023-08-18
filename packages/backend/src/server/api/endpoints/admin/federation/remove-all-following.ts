import { z } from 'zod';
import { Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import { QueueService } from '@/core/QueueService.js';
import { PrismaService } from '@/core/PrismaService.js';

export const meta = {
	tags: ['admin'],
	requireCredential: true,
	requireModerator: true,
} as const;

export const paramDef = z.object({ host: z.string() });

@Injectable()
// eslint-disable-next-line import/no-default-export
export default class extends Endpoint<
	typeof meta,
	typeof paramDef,
	z.ZodType<void>
> {
	constructor(
		private readonly queueService: QueueService,
		private readonly prismaService: PrismaService,
	) {
		super(meta, paramDef, async (ps) => {
			const followings = await this.prismaService.client.following.findMany({
				where: {
					followerHost: ps.host,
				},
				include: {
					user_following_followeeIdTouser: true,
					user_following_followerIdTouser: true,
				},
			});

			await this.queueService.createUnfollowJob(
				followings.map((f) => {
					const from = f.user_following_followerIdTouser;
					const to = f.user_following_followeeIdTouser;
					return { from: { id: from.id }, to: { id: to.id }, silent: true };
				}),
			);
		});
	}
}
