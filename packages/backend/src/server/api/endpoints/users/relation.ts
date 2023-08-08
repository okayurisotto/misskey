import { z } from 'zod';
import { Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import { UserEntityService } from '@/core/entities/UserEntityService.js';
import { MisskeyIdSchema } from '@/models/zod/misc.js';

const resBase = z.object({
	id: MisskeyIdSchema,
	isFollowing: z.boolean(),
	hasPendingFollowRequestFromYou: z.boolean(),
	hasPendingFollowRequestToYou: z.boolean(),
	isFollowed: z.boolean(),
	isBlocking: z.boolean(),
	isBlocked: z.boolean(),
	isMuted: z.boolean(),
	isRenoteMuted: z.boolean(),
});
const res = z.union([resBase, z.array(resBase)]);
export const meta = {
	tags: ['users'],
	requireCredential: true,
	description:
		'Show the different kinds of relations between the authenticated user and the specified user(s).',
	res,
} as const;

export const paramDef = z.object({
	userId: z.union([MisskeyIdSchema, z.array(MisskeyIdSchema)]),
});

@Injectable()
// eslint-disable-next-line import/no-default-export
export default class extends Endpoint<
	typeof meta,
	typeof paramDef,
	typeof res
> {
	constructor(private userEntityService: UserEntityService) {
		super(meta, paramDef, async (ps, me) => {
			const ids = Array.isArray(ps.userId) ? ps.userId : [ps.userId];

			const relations = await Promise.all(
				ids.map((id) => this.userEntityService.getRelation(me.id, id)),
			);

			return (
				Array.isArray(ps.userId) ? relations : relations[0]
			) satisfies z.infer<typeof res>;
		});
	}
}
