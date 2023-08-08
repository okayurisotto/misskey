import { z } from 'zod';
import { Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import { UserEntityService } from '@/core/entities/UserEntityService.js';
import { UserDetailedNotMeSchema } from '@/models/zod/UserDetailedNotMeSchema.js';
import { MisskeyIdSchema } from '@/models/zod/misc.js';
import { PrismaService } from '@/core/PrismaService.js';
import { PrismaQueryService } from '@/core/PrismaQueryService.js';

const res = z.array(UserDetailedNotMeSchema);
export const meta = {
	tags: ['federation'],
	requireCredential: false,
	res,
} as const;

export const paramDef = z.object({
	host: z.string(),
	sinceId: MisskeyIdSchema.optional(),
	untilId: MisskeyIdSchema.optional(),
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
		private readonly userEntityService: UserEntityService,
		private readonly prismaService: PrismaService,
		private readonly prismaQueryService: PrismaQueryService,
	) {
		super(meta, paramDef, async (ps, me) => {
			const paginationQuery = this.prismaQueryService.getPaginationQuery({
				sinceId: ps.sinceId,
				untilId: ps.untilId,
			});

			const users = await this.prismaService.client.user.findMany({
				where: { AND: [paginationQuery.where, { host: ps.host }] },
				orderBy: paginationQuery.orderBy,
				take: ps.limit,
			});

			return (await Promise.all(
				users.map((user) =>
					this.userEntityService.pack(user, me, { detail: true }),
				),
			)) satisfies z.infer<typeof res>;
		});
	}
}
