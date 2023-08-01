import { z } from 'zod';
import { Inject, Injectable } from '@nestjs/common';
import type {
	UserProfilesRepository,
	NoteReactionsRepository,
} from '@/models/index.js';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import { QueryService } from '@/core/QueryService.js';
import { NoteReactionEntityService } from '@/core/entities/NoteReactionEntityService.js';
import { DI } from '@/di-symbols.js';
import { NoteReactionSchema } from '@/models/zod/NoteReactionSchema.js';
import { misskeyIdPattern } from '@/models/zod/misc.js';
import { ApiError } from '../../error.js';

const res = z.array(NoteReactionSchema);
export const meta = {
	tags: ['users', 'reactions'],
	requireCredential: false,
	description: 'Show all reactions this user made.',
	res,
	errors: {
		reactionsNotPublic: {
			message: 'Reactions of the user is not public.',
			code: 'REACTIONS_NOT_PUBLIC',
			id: '673a7dd2-6924-1093-e0c0-e68456ceae5c',
		},
	},
} as const;

export const paramDef = z.object({
	userId: misskeyIdPattern,
	limit: z.number().int().min(1).max(100).default(10),
	sinceId: misskeyIdPattern.optional(),
	untilId: misskeyIdPattern.optional(),
	sinceDate: z.number().int().optional(),
	untilDate: z.number().int().optional(),
});

@Injectable()
// eslint-disable-next-line import/no-default-export
export default class extends Endpoint<
	typeof meta,
	typeof paramDef,
	typeof res
> {
	constructor(
		@Inject(DI.userProfilesRepository)
		private userProfilesRepository: UserProfilesRepository,

		@Inject(DI.noteReactionsRepository)
		private noteReactionsRepository: NoteReactionsRepository,

		private noteReactionEntityService: NoteReactionEntityService,
		private queryService: QueryService,
	) {
		super(meta, paramDef, async (ps, me) => {
			const profile = await this.userProfilesRepository.findOneByOrFail({
				userId: ps.userId,
			});

			if ((me == null || me.id !== ps.userId) && !profile.publicReactions) {
				throw new ApiError(meta.errors.reactionsNotPublic);
			}

			const query = this.queryService
				.makePaginationQuery(
					this.noteReactionsRepository.createQueryBuilder('reaction'),
					ps.sinceId,
					ps.untilId,
					ps.sinceDate,
					ps.untilDate,
				)
				.andWhere('reaction.userId = :userId', { userId: ps.userId })
				.leftJoinAndSelect('reaction.note', 'note');

			this.queryService.generateVisibilityQuery(query, me);

			const reactions = await query.limit(ps.limit).getMany();

			return (await Promise.all(
				reactions.map((reaction) =>
					this.noteReactionEntityService.pack(reaction, me, { withNote: true }),
				),
			)) satisfies z.infer<typeof res>;
		});
	}
}
