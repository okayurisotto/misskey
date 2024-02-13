import { z } from 'zod';
import ms from 'ms';
import { Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import { UserEntityService } from '@/core/entities/UserEntityService.js';
import { UserDetailedSchema } from '@/models/zod/UserDetailedSchema.js';
import { PrismaService } from '@/core/PrismaService.js';
import { PrismaQueryService } from '@/core/PrismaQueryService.js';
import { limit } from '@/models/zod/misc.js';

const res = z.array(UserDetailedSchema);
export const meta = {
	tags: ['users'],
	requireCredential: true,
	kind: 'read:account',
	description:
		'Show users that the authenticated user might be interested to follow.',
	res,
} as const;

export const paramDef = z.object({
	limit: limit({ max: 100, default: 10 }),
	offset: z.number().int().default(0),
});

@Injectable()
// eslint-disable-next-line import/no-default-export
export default class extends Endpoint<
	typeof meta,
	typeof paramDef,
	typeof res
> {
	constructor(
		private readonly userEntityService: UserEntityService,
		private readonly prismaService: PrismaService,
		private readonly prismaQueryService: PrismaQueryService,
	) {
		super(meta, paramDef, async (ps, me) => {
			const users = await this.prismaService.client.user.findMany({
				where: {
					AND: [
						{
							isLocked: false,
							isExplorable: true,
							host: null,
							updatedAt: { gt: new Date(Date.now() - ms('7days')) },
							id: { not: me.id },
						},
						this.prismaQueryService.getMutingWhereForUser(me.id),
						this.prismaQueryService.getBlockedWhereForUser(me.id),
						{
							followings_followee: {
								none: { followerId: me.id },
							},
						},
					],
				},
				orderBy: { followersCount: 'desc' },
			});

			return await Promise.all(
				users.map((user) => this.userEntityService.packDetailed(user, me)),
			);
		});
	}
}
