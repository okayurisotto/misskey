import { z } from 'zod';
import { generateSchema } from '@anatine/zod-openapi';
import { Inject, Injectable } from '@nestjs/common';
import type {
	AnnouncementsRepository,
	AnnouncementReadsRepository,
} from '@/models/index.js';
import type { Announcement } from '@/models/entities/Announcement.js';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import { QueryService } from '@/core/QueryService.js';
import { DI } from '@/di-symbols.js';
import { misskeyIdPattern } from '@/models/zod/misc.js';

const res = z.array(
	z.object({
		id: misskeyIdPattern,
		createdAt: z.string().datetime(),
		updatedAt: z.string().datetime().nullable(),
		text: z.string(),
		title: z.string(),
		imageUrl: z.string().nullable(),
		reads: z.number(),
	}),
);
export const meta = {
	tags: ['admin'],
	requireCredential: true,
	requireModerator: true,
	res: generateSchema(res),
} as const;

const paramDef_ = z.object({
	limit: z.number().int().min(1).max(100).default(10),
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

			const announcements = await query.limit(ps.limit ?? 10).getMany();

			const reads = new Map<Announcement, number>();

			for (const announcement of announcements) {
				reads.set(
					announcement,
					await this.announcementReadsRepository.countBy({
						announcementId: announcement.id,
					}),
				);
			}

			return announcements.map((announcement) => ({
				id: announcement.id,
				createdAt: announcement.createdAt.toISOString(),
				updatedAt: announcement.updatedAt?.toISOString() ?? null,
				title: announcement.title,
				text: announcement.text,
				imageUrl: announcement.imageUrl,
				reads: reads.get(announcement)!,
			})) satisfies z.infer<typeof res>;
		});
	}
}
