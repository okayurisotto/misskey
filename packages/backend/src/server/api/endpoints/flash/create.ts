import { z } from 'zod';
import { generateSchema } from '@anatine/zod-openapi';
import ms from 'ms';
import { Inject, Injectable } from '@nestjs/common';
import type { FlashsRepository } from '@/models/index.js';
import { IdService } from '@/core/IdService.js';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import { DI } from '@/di-symbols.js';
import { FlashEntityService } from '@/core/entities/FlashEntityService.js';

const res = z.unknown();
export const meta = {
	tags: ['flash'],
	requireCredential: true,
	prohibitMoved: true,
	kind: 'write:flash',
	limit: {
		duration: ms('1hour'),
		max: 10,
	},
	errors: {},
	res: generateSchema(res),
} as const;

const paramDef_ = z.object({
	title: z.string(),
	summary: z.string(),
	script: z.string(),
	permissions: z.array(z.string()),
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
		@Inject(DI.flashsRepository)
		private flashsRepository: FlashsRepository,

		private flashEntityService: FlashEntityService,
		private idService: IdService,
	) {
		super(meta, paramDef_, async (ps, me) => {
			const flash = await this.flashsRepository
				.insert({
					id: this.idService.genId(),
					userId: me.id,
					createdAt: new Date(),
					updatedAt: new Date(),
					title: ps.title,
					summary: ps.summary,
					script: ps.script,
					permissions: ps.permissions,
				})
				.then((x) => this.flashsRepository.findOneByOrFail(x.identifiers[0]));

			return await this.flashEntityService.pack(flash) satisfies z.infer<typeof res>;
		});
	}
}
