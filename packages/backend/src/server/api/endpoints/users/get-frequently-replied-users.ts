import { z } from 'zod';
import { Injectable } from '@nestjs/common';
import { noSuchUser___________________ } from '@/server/api/errors.js';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import { UserEntityService } from '@/core/entities/UserEntityService.js';
import { GetterService } from '@/server/api/GetterService.js';
import { UserDetailedSchema } from '@/models/zod/UserDetailedSchema.js';
import { MisskeyIdSchema, limit } from '@/models/zod/misc.js';
import { PrismaService } from '@/core/PrismaService.js';
import { ApiError } from '../../error.js';

const res = z.array(
	z.object({
		user: UserDetailedSchema,
		weight: z.number(),
	}),
);
export const meta = {
	tags: ['users'],
	requireCredential: false,
	description:
		'Get a list of other users that the specified user frequently replies to.',
	res,
	errors: { noSuchUser: noSuchUser___________________ },
} as const;

export const paramDef = z.object({
	userId: MisskeyIdSchema,
	limit: limit({ max: 100, default: 10 }),
});

@Injectable()
// eslint-disable-next-line import/no-default-export
export default class extends Endpoint<
	typeof meta,
	typeof paramDef,
	typeof res
> {
	constructor(
		private userEntityService: UserEntityService,
		private getterService: GetterService,
		private prismaService: PrismaService,
	) {
		super(meta, paramDef, async (ps, me) => {
			// Lookup user
			const user = await this.getterService.getUser(ps.userId).catch((err) => {
				if (err.id === '15348ddd-432d-49c2-8a5a-8069753becff') {
					throw new ApiError(meta.errors.noSuchUser);
				}
				throw err;
			});

			// Fetch recent notes
			const recentNotes = await this.prismaService.client.note.findMany({
				where: {
					userId: user.id,
					replyId: { not: null },
				},
				orderBy: { id: 'desc' },
				take: 1000,
			});

			// 投稿が少なかったら中断
			if (recentNotes.length === 0) {
				return [];
			}

			// TODO ミュートを考慮
			const replyTargetNotes = await this.prismaService.client.note.findMany({
				where: {
					id: { in: recentNotes.map((p) => p.replyId!) },
				},
			});

			const repliedUsers: Record<string, number> = {};

			// Extract replies from recent notes
			for (const userId of replyTargetNotes.map((x) => x.userId.toString())) {
				if (repliedUsers[userId]) {
					repliedUsers[userId]++;
				} else {
					repliedUsers[userId] = 1;
				}
			}

			// Calc peak
			const peak = Math.max(...Object.values(repliedUsers));

			// Sort replies by frequency
			const repliedUsersSorted = Object.keys(repliedUsers).sort(
				(a, b) => repliedUsers[b] - repliedUsers[a],
			);

			// Extract top replied users
			const topRepliedUsers = repliedUsersSorted.slice(0, ps.limit);

			// Make replies object (includes weights)
			const repliesObj = await Promise.all(
				topRepliedUsers.map(async (user) => ({
					user: await this.userEntityService.packDetailed(user, me),
					weight: repliedUsers[user] / peak,
				})),
			);

			return repliesObj;
		});
	}
}
