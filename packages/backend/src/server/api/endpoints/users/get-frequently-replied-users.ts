import { z } from 'zod';
import { Not, In, IsNull } from 'typeorm';
import { Inject, Injectable } from '@nestjs/common';
import { maximum } from '@/misc/prelude/array.js';
import type { NotesRepository, UsersRepository } from '@/models/index.js';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import { UserEntityService } from '@/core/entities/UserEntityService.js';
import { DI } from '@/di-symbols.js';
import { GetterService } from '@/server/api/GetterService.js';
import { UserDetailedSchema } from '@/models/zod/UserDetailedSchema.js';
import { misskeyIdPattern } from '@/models/zod/misc.js';
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
	errors: {
		noSuchUser: {
			message: 'No such user.',
			code: 'NO_SUCH_USER',
			id: 'e6965129-7b2a-40a4-bae2-cd84cd434822',
		},
	},
} as const;

export const paramDef = z.object({
	userId: misskeyIdPattern,
	limit: z.number().int().min(1).max(100).default(10),
});

@Injectable()
// eslint-disable-next-line import/no-default-export
export default class extends Endpoint<
	typeof meta,
	typeof paramDef,
	typeof res
> {
	constructor(
		@Inject(DI.usersRepository)
		private usersRepository: UsersRepository,

		@Inject(DI.notesRepository)
		private notesRepository: NotesRepository,

		private userEntityService: UserEntityService,
		private getterService: GetterService,
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
			const recentNotes = await this.notesRepository.find({
				where: {
					userId: user.id,
					replyId: Not(IsNull()),
				},
				order: {
					id: -1,
				},
				take: 1000,
				select: ['replyId'],
			});

			// 投稿が少なかったら中断
			if (recentNotes.length === 0) {
				return [];
			}

			// TODO ミュートを考慮
			const replyTargetNotes = await this.notesRepository.find({
				where: {
					id: In(recentNotes.map((p) => p.replyId)),
				},
				select: ['userId'],
			});

			const repliedUsers: any = {};

			// Extract replies from recent notes
			for (const userId of replyTargetNotes.map((x) => x.userId.toString())) {
				if (repliedUsers[userId]) {
					repliedUsers[userId]++;
				} else {
					repliedUsers[userId] = 1;
				}
			}

			// Calc peak
			const peak = maximum(Object.values(repliedUsers));

			// Sort replies by frequency
			const repliedUsersSorted = Object.keys(repliedUsers).sort(
				(a, b) => repliedUsers[b] - repliedUsers[a],
			);

			// Extract top replied users
			const topRepliedUsers = repliedUsersSorted.slice(0, ps.limit);

			// Make replies object (includes weights)
			const repliesObj = await Promise.all(
				topRepliedUsers.map(async (user) => ({
					user: await this.userEntityService.pack(user, me, { detail: true }),
					weight: repliedUsers[user] / peak,
				})),
			);

			return repliesObj satisfies z.infer<typeof res>;
		});
	}
}
