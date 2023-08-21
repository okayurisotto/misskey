import { z } from 'zod';
import { Injectable } from '@nestjs/common';
import { pick } from 'omick';
import { noSuchAnnouncement_ } from '@/server/api/errors.js';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import { MisskeyIdSchema } from '@/models/zod/misc.js';
import { AnnouncementEntityService } from '@/core/entities/AnnouncementEntityService.js';

export const meta = {
	tags: ['admin'],
	requireCredential: true,
	requireModerator: true,
	errors: { noSuchAnnouncement: noSuchAnnouncement_ },
} as const;

export const paramDef = z.object({
	id: MisskeyIdSchema,
	imageUrl: z.string().min(0).nullable(),
	text: z.string().min(1),
	title: z.string().min(1),
});

@Injectable()
// eslint-disable-next-line import/no-default-export
export default class extends Endpoint<
	typeof meta,
	typeof paramDef,
	z.ZodType<void>
> {
	constructor(
		private readonly announcementEntityService: AnnouncementEntityService,
	) {
		super(meta, paramDef, async (ps) => {
			await this.announcementEntityService.update(
				{ id: ps.id },
				pick(ps, ['imageUrl', 'text', 'title']),
			);
		});
	}
}
