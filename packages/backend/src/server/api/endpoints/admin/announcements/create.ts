import { z } from 'zod';
import { Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import { AnnouncementSchema } from '@/models/zod/AnnouncementSchema.js';
import { AnnouncementEntityService } from '@/core/entities/AnnouncementEntityService.js';
import { EntityMap } from '@/misc/EntityMap.js';

const res = AnnouncementSchema;
export const meta = {
	tags: ['admin'],
	requireCredential: true,
	requireModerator: true,
	res,
} as const;

export const paramDef = z.object({
	title: z.string().min(1),
	text: z.string().min(1),
	imageUrl: z.string().min(1).nullable(),
});

@Injectable()
// eslint-disable-next-line import/no-default-export
export default class extends Endpoint<
	typeof meta,
	typeof paramDef,
	typeof res
> {
	constructor(
		private readonly announcementEntityService: AnnouncementEntityService,
	) {
		super(meta, paramDef, async (ps) => {
			const announcement = await this.announcementEntityService.create({
				title: ps.title,
				text: ps.text,
				imageUrl: ps.imageUrl,
			});

			return this.announcementEntityService.pack(announcement.id, {
				announcement: new EntityMap('id', [announcement]),
				announcement_read: new EntityMap('id', []),
			});
		});
	}
}
