import { Inject, Injectable } from '@nestjs/common';
import { z } from 'zod';
import { generateSchema } from '@anatine/zod-openapi';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import { QueryService } from '@/core/QueryService.js';
import { DI } from '@/di-symbols.js';
import type {
	AnnouncementReadsRepository,
	AnnouncementsRepository,
} from '@/models/index.js';
import { misskeyIdPattern } from '@/models/zod/misc.js';

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

	res: generateSchema(res),
} as const;

const paramDef_ = z.object({
	limit: z.number().int().min(1).max(100).optional(),
	withUnreads: z.boolean().optional(),
	sinceId: misskeyIdPattern.optional(),
	untilId: misskeyIdPattern.optional(),
});
export const paramDef = generateSchema(paramDef_);

@Injectable()
// eslint-disable-next-line import/no-default-export
export default class extends Endpoint<
	typeof meta,
	typeof paramDef_,
	typeof res
> {
	constructor(
		@Inject(DI.announcementsRepository)
		private announcementsRepository: AnnouncementsRepository,

		@Inject(DI.announcementReadsRepository)
		private announcementReadsRepository: AnnouncementReadsRepository,

		private queryService: QueryService,
	) {
		super(meta, paramDef_, async (ps, me) => {
			const query = this.queryService.makePaginationQuery(
				this.announcementsRepository.createQueryBuilder('announcement'),
				ps.sinceId,
				ps.untilId,
			);

			const announcements = await query.limit(ps.limit).getMany();

			if (me) {
				const reads = (
					await this.announcementReadsRepository.findBy({
						userId: me.id,
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
