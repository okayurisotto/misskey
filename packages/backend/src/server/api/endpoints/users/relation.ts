import { z } from 'zod';
import { Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import { UserEntityService } from '@/core/entities/UserEntityService.js';
import { MisskeyIdSchema } from '@/models/zod/misc.js';
import { UserRelationSchema } from '@/models/zod/UserRelationSchema.js';

const resBase = UserRelationSchema.merge(z.object({ id: MisskeyIdSchema }));
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
			if (Array.isArray(ps.userId)) {
				return await Promise.all(
					ps.userId.map((id) => this.userEntityService.getRelation(me.id, id)),
				);
			} else {
				return this.userEntityService.getRelation(me.id, ps.userId);
			}
		});
	}
}
