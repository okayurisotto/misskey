import { z } from 'zod';
import { Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import { PaginationSchema, limit } from '@/models/zod/misc.js';
import { PrismaQueryService } from '@/core/PrismaQueryService.js';
import { AnnouncementForAdminSchema } from '@/models/zod/AnnouncementForAdminSchema.js';
import { AnnouncementEntityService } from '@/core/entities/AnnouncementEntityService.js';

const res = z.array(AnnouncementForAdminSchema);
export const meta = {
	tags: ['admin'],
	requireCredential: true,
	requireModerator: true,
	res,
} as const;

export const paramDef = z
	.object({ limit: limit({ max: 100, default: 10 }) })
	.merge(PaginationSchema.pick({ sinceId: true, untilId: true }));

@Injectable()
// eslint-disable-next-line import/no-default-export
export default class extends Endpoint<
	typeof meta,
	typeof paramDef,
	typeof res
> {
	constructor(
		private readonly prismaQueryService: PrismaQueryService,
		private readonly announcementEntityService: AnnouncementEntityService,
	) {
		super(meta, paramDef, async (ps) => {
			const paginationQuery = this.prismaQueryService.getPaginationQuery({
				sinceId: ps.sinceId,
				untilId: ps.untilId,
				take: ps.limit,
			});

			return this.announcementEntityService.showMany({}, paginationQuery);
		});
	}
}
