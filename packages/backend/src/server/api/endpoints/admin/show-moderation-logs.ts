import { z } from 'zod';
import { Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import { ModerationLogEntityService } from '@/core/entities/ModerationLogEntityService.js';
import { MisskeyIdSchema, limit } from '@/models/zod/misc.js';
import { UserDetailedSchema } from '@/models/zod/UserDetailedSchema.js';
import { PrismaService } from '@/core/PrismaService.js';
import { PrismaQueryService } from '@/core/PrismaQueryService.js';

const res = z.array(
	z.object({
		id: MisskeyIdSchema,
		createdAt: z.string().datetime(),
		type: z.string(),
		info: z.unknown(),
		userId: MisskeyIdSchema,
		user: UserDetailedSchema,
	}),
);
export const meta = {
	tags: ['admin'],
	requireCredential: true,
	requireModerator: true,
	res,
} as const;

export const paramDef = z.object({
	limit: limit({ max: 100, default: 10 }),
	sinceId: MisskeyIdSchema.optional(),
	untilId: MisskeyIdSchema.optional(),
});

@Injectable()
// eslint-disable-next-line import/no-default-export
export default class extends Endpoint<
	typeof meta,
	typeof paramDef,
	typeof res
> {
	constructor(
		private readonly moderationLogEntityService: ModerationLogEntityService,
		private readonly prismaService: PrismaService,
		private readonly prismaQueryService: PrismaQueryService,
	) {
		super(meta, paramDef, async (ps) => {
			const paginationQuery = this.prismaQueryService.getPaginationQuery({
				sinceId: ps.sinceId,
				untilId: ps.untilId,
			});

			const reports = await this.prismaService.client.moderation_log.findMany({
				where: { AND: [paginationQuery.where] },
				orderBy: paginationQuery.orderBy,
				take: ps.limit,
			});

			return (await Promise.all(
				reports.map((report) => this.moderationLogEntityService.pack(report)),
			)) satisfies z.infer<typeof res>;
		});
	}
}
