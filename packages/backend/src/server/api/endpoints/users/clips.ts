import { z } from 'zod';
import { Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import { ClipEntityService } from '@/core/entities/ClipEntityService.js';
import { ClipSchema } from '@/models/zod/ClipSchema.js';
import { MisskeyIdSchema, limit } from '@/models/zod/misc.js';
import { PrismaService } from '@/core/PrismaService.js';
import { PrismaQueryService } from '@/core/PrismaQueryService.js';

const res = z.array(ClipSchema);
export const meta = {
	tags: ['users', 'clips'],
	description: 'Show all clips this user owns.',
	res,
} as const;

export const paramDef = z.object({
	userId: MisskeyIdSchema,
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
		private readonly clipEntityService: ClipEntityService,
		private readonly prismaService: PrismaService,
		private readonly prismaQueryService: PrismaQueryService,
	) {
		super(meta, paramDef, async (ps, me) => {
			const paginationQuery = this.prismaQueryService.getPaginationQuery({
				sinceId: ps.sinceId,
				untilId: ps.untilId,
			});

			const clips = await this.prismaService.client.clip.findMany({
				where: {
					AND: [
						paginationQuery.where,
						{ userId: ps.userId, isPublic: true },
					],
				},
				orderBy: paginationQuery.orderBy,
				take: ps.limit,
			});

			return (await Promise.all(
				clips.map((clip) => this.clipEntityService.pack(clip, me)),
			)) satisfies z.infer<typeof res>;
		});
	}
}
