import { Injectable } from '@nestjs/common';
import { z } from 'zod';
import { pick } from 'omick';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import { PaginationSchema } from '@/models/zod/misc.js';
import { PrismaService } from '@/core/PrismaService.js';
import { PrismaQueryService } from '@/core/PrismaQueryService.js';
import { AnnouncementSchema } from '@/models/zod/AnnouncementSchema.js';

const res = z.array(AnnouncementSchema);
export const meta = {
	tags: ['meta'],
	requireCredential: false,
	res,
} as const;

export const paramDef = z
	.object({
		limit: z.number().int().min(1).max(100).optional(),
		withUnreads: z.boolean().default(false),
	})
	.merge(PaginationSchema.pick({ sinceId: true, untilId: true }));

@Injectable()
// eslint-disable-next-line import/no-default-export
export default class extends Endpoint<
	typeof meta,
	typeof paramDef,
	typeof res
> {
	constructor(
		private readonly prismaService: PrismaService,
		private readonly prismaQueryService: PrismaQueryService,
	) {
		super(meta, paramDef, async (ps, me) => {
			const paginationQuery = this.prismaQueryService.getPaginationQuery({
				sinceId: ps.sinceId,
				untilId: ps.untilId,
			});

			if (me) {
				const announcements =
					await this.prismaService.client.announcement.findMany({
						where: {
							AND: [
								paginationQuery.where,
								ps.withUnreads
									? {
											announcement_read: { none: { userId: me.id } },
									  }
									: {},
							],
						},
						include: {
							_count: {
								select: { announcement_read: { where: { userId: me.id } } },
							},
						},
						orderBy: paginationQuery.orderBy,
						take: ps.limit,
					});

				return announcements.map((announcement) => ({
					...pick(announcement, ['id', 'title', 'text', 'imageUrl']),
					createdAt: announcement.createdAt.toISOString(),
					updatedAt: announcement.updatedAt?.toISOString() ?? null,
					isRead: announcement._count.announcement_read !== 0,
				}));
			} else {
				const announcements =
					await this.prismaService.client.announcement.findMany({
						where: { AND: [paginationQuery.where] },
						orderBy: paginationQuery.orderBy,
						take: ps.limit,
					});

				return announcements.map((announcement) => ({
					...pick(announcement, ['id', 'title', 'text', 'imageUrl']),
					createdAt: announcement.createdAt.toISOString(),
					updatedAt: announcement.updatedAt?.toISOString() ?? null,
				}));
			}
		});
	}
}
