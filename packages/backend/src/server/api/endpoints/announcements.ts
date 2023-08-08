import { Injectable } from '@nestjs/common';
import { z } from 'zod';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import { MisskeyIdSchema } from '@/models/zod/misc.js';
import { PrismaService } from '@/core/PrismaService.js';
import { PrismaQueryService } from '@/core/PrismaQueryService.js';

const res = z.array(
	z.object({
		id: z.string(),
		createdAt: z.string().datetime(),
		updatedAt: z.string().datetime().nullable(),
		text: z.string(),
		imageUrl: z.string().nullable(),
		isRead: z.boolean().optional(),
	}),
);
export const meta = {
	tags: ['meta'],

	requireCredential: false,

	res,
} as const;

export const paramDef = z.object({
	limit: z.number().int().min(1).max(100).optional(),
	withUnreads: z.boolean().optional(),
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
		private readonly prismaService: PrismaService,
		private readonly prismaQueryService: PrismaQueryService,
	) {
		super(meta, paramDef, async (ps, me) => {
			const paginationQuery = this.prismaQueryService.getPaginationQuery({
				sinceId: ps.sinceId,
				untilId: ps.untilId,
			});

			const announcements =
				await this.prismaService.client.announcement.findMany({
					where: { AND: [paginationQuery.where] },
					orderBy: paginationQuery.orderBy,
					take: ps.limit,
				});

			if (me) {
				const reads = (
					await this.prismaService.client.announcement_read.findMany({
						where: { userId: me.id },
					})
				).map((x) => x.announcementId);

				for (const announcement of announcements) {
					(announcement as any).isRead = reads.includes(announcement.id);
				}
			}

			return (
				ps.withUnreads
					? announcements.filter((a: any) => !a.isRead)
					: announcements
			).map((a) => ({
				...a,
				createdAt: a.createdAt.toISOString(),
				updatedAt: a.updatedAt?.toISOString() ?? null,
			})) satisfies z.infer<typeof res>;
		});
	}
}
