import { z } from 'zod';
import { Inject, Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import type { AnnouncementsRepository } from '@/models/index.js';
import { DI } from '@/di-symbols.js';
import { misskeyIdPattern } from '@/models/zod/misc.js';
import { ApiError } from '../../../error.js';

export const meta = {
	tags: ['admin'],
	requireCredential: true,
	requireModerator: true,
	errors: {
		noSuchAnnouncement: {
			message: 'No such announcement.',
			code: 'NO_SUCH_ANNOUNCEMENT',
			id: 'ecad8040-a276-4e85-bda9-015a708d291e',
		},
	},
} as const;

export const paramDef = z.object({
	id: misskeyIdPattern,
});

@Injectable()
// eslint-disable-next-line import/no-default-export
export default class extends Endpoint<
	typeof meta,
	typeof paramDef,
	z.ZodType<void>
> {
	constructor(
		@Inject(DI.announcementsRepository)
		private announcementsRepository: AnnouncementsRepository,
	) {
		super(meta, paramDef, async (ps, me) => {
			const announcement = await this.announcementsRepository.findOneBy({
				id: ps.id,
			});

			if (announcement == null) {
				throw new ApiError(meta.errors.noSuchAnnouncement);
			}

			await this.announcementsRepository.delete(announcement.id);
		});
	}
}
