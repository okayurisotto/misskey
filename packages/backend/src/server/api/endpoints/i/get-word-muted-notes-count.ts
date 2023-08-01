import { z } from 'zod';
import { generateSchema } from '@anatine/zod-openapi';
import { Inject, Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import type { MutedNotesRepository } from '@/models/index.js';
import { DI } from '@/di-symbols.js';

const res = z.object({
	count: z.number(),
});
export const meta = {
	tags: ['account'],
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
		@Inject(DI.mutedNotesRepository)
		private mutedNotesRepository: MutedNotesRepository,
	) {
		super(meta, paramDef_, async (ps, me) => {
			return {
				count: await this.mutedNotesRepository.countBy({
					userId: me.id,
					reason: 'word',
				}),
			} satisfies z.infer<typeof res>;
		});
	}
}
