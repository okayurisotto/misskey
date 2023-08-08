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
			});

			const pairs = await Promise.all(
				followings.map((f) =>
					Promise.all([
						this.prismaService.client.user.findUniqueOrThrow({
							where: { id: f.followerId },
						}),
						this.prismaService.client.user.findUniqueOrThrow({
							where: { id: f.followeeId },
						}),
					]).then(([from, to]) => [{ id: from.id }, { id: to.id }]),
				),
			);

			await this.queueService.createUnfollowJob(
				pairs.map((p) => ({ from: p[0], to: p[1], silent: true })),
			);
		});
	}
}
