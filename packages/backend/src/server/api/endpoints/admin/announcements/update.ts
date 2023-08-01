import { z } from 'zod';
import { generateSchema } from '@anatine/zod-openapi';
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
			id: 'd3aae5a7-6372-4cb4-b61c-f511ffc2d7cc',
		},
	},
} as const;

const paramDef_ = z.object({
	id: misskeyIdPattern,
	title: z.string().min(1),
	text: z.string().min(1),
	imageUrl: z.string().min(0).nullable(),
});
export const paramDef = generateSchema(paramDef_);

@Injectable()
// eslint-disable-next-line import/no-default-export
export default class extends Endpoint<
	typeof meta,
	typeof paramDef_,
	z.ZodType<void>
> {
	constructor(
		@Inject(DI.announcementsRepository)
		private announcementsRepository: AnnouncementsRepository,
	) {
		super(meta, paramDef_, async (ps, me) => {
			const announcement = await this.announcementsRepository.findOneBy({
				id: ps.id,
			});

			if (announcement == null) {
				throw new ApiError(meta.errors.noSuchAnnouncement);
			}

			await this.announcementsRepository.update(announcement.id, {
				updatedAt: new Date(),
				title: ps.title,
				text: ps.text,
				/* eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing -- 空の文字列の場合、nullを渡すようにするため */
				imageUrl: ps.imageUrl || null,
			});
		});
	}
}
