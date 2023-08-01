import { z } from 'zod';
import { generateSchema } from '@anatine/zod-openapi';
import { Inject, Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import type { AnnouncementsRepository } from '@/models/index.js';
import { IdService } from '@/core/IdService.js';
import { DI } from '@/di-symbols.js';
import { misskeyIdPattern } from '@/models/zod/misc.js';

const res = z.object({
	id: misskeyIdPattern,
	createdAt: z.string().datetime(),
	updatedAt: z.string().datetime().nullable(),
	title: z.string(),
	text: z.string(),
	imageUrl: z.string().nullable(),
});
export const meta = {
	tags: ['admin'],
	requireCredential: true,
	requireModerator: true,
	res: generateSchema(res),
} as const;

const paramDef_ = z.object({
	title: z.string().min(1),
	text: z.string().min(1),
	imageUrl: z.string().min(1).nullable(),
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

		private idService: IdService,
	) {
		super(meta, paramDef_, async (ps, me) => {
			const announcement = await this.announcementsRepository
				.insert({
					id: this.idService.genId(),
					createdAt: new Date(),
					updatedAt: null,
					title: ps.title,
					text: ps.text,
					imageUrl: ps.imageUrl,
				})
				.then((x) =>
					this.announcementsRepository.findOneByOrFail(x.identifiers[0]),
				);

			return Object.assign({}, announcement, {
				createdAt: announcement.createdAt.toISOString(),
				updatedAt: null,
			}) satisfies z.infer<typeof res>;
		});
	}
}
