import { z } from 'zod';
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
	res,
} as const;

export const paramDef = z.object({});

@Injectable()
// eslint-disable-next-line import/no-default-export
export default class extends Endpoint<
	typeof meta,
	typeof paramDef,
	typeof res
> {
	constructor(
		@Inject(DI.mutedNotesRepository)
		private mutedNotesRepository: MutedNotesRepository,
	) {
		super(meta, paramDef, async (ps, me) => {
			return {
				count: await this.mutedNotesRepository.countBy({
					userId: me.id,
					reason: 'word',
				}),
			} satisfies z.infer<typeof res>;
		});
	}
}
