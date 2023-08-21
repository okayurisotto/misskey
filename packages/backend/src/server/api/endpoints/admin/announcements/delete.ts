import { z } from 'zod';
import { Injectable } from '@nestjs/common';
import { pick } from 'omick';
import { noSuchAnnouncement } from '@/server/api/errors.js';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import { MisskeyIdSchema } from '@/models/zod/misc.js';
import { AnnouncementEntityService } from '@/core/entities/AnnouncementEntityService.js';

export const meta = {
	tags: ['admin'],
	requireCredential: true,
	requireModerator: true,
	errors: { noSuchAnnouncement: noSuchAnnouncement },
} as const;

export const paramDef = z.object({ id: MisskeyIdSchema });

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
			await this.announcementEntityService.delete(pick(ps, ['id']));
		});
	}
}
