import { z } from 'zod';
import { generateSchema } from '@anatine/zod-openapi';
import { Inject, Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import type { ClipsRepository } from '@/models/index.js';
import { ClipEntityService } from '@/core/entities/ClipEntityService.js';
import { DI } from '@/di-symbols.js';
import { ClipSchema } from '@/models/zod/ClipSchema.js';

const res = z.array(ClipSchema);
export const meta = {
	tags: ['clips', 'account'],
	requireCredential: true,
	kind: 'read:account',
	res: generateSchema(res),
} as const;

const paramDef_ = z.object({});
export const paramDef = generateSchema(paramDef_);

@Injectable()
// eslint-disable-next-line import/no-default-export
export default class extends Endpoint<
	typeof meta,
	typeof paramDef_,
	typeof res
> {
	constructor(
		@Inject(DI.clipsRepository)
		private clipsRepository: ClipsRepository,

		private clipEntityService: ClipEntityService,
	) {
		super(meta, paramDef_, async (ps, me) => {
			const clips = await this.clipsRepository.findBy({
				userId: me.id,
			});

			return (await this.clipEntityService.packMany(
				clips,
				me,
			)) satisfies z.infer<typeof res>;
		});
	}
}
