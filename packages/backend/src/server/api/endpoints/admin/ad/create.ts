import { z } from 'zod';
import { Injectable } from '@nestjs/common';
import { pick } from 'omick';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import { AdSchema } from '@/models/zod/AdSchema.js';
import { AdEntityService } from '@/core/entities/AdEntityService.js';

export const meta = {
	tags: ['admin'],
	requireCredential: true,
	requireModerator: true,
} as const;

export const paramDef = AdSchema.omit({ id: true });

@Injectable()
// eslint-disable-next-line import/no-default-export
export default class extends Endpoint<
	typeof meta,
	typeof paramDef,
	z.ZodType<void>
> {
	constructor(private readonly adEntityService: AdEntityService) {
		super(meta, paramDef, async (ps) => {
			await this.adEntityService.create({
				...pick(ps, [
					'dayOfWeek',
					'imageUrl',
					'memo',
					'place',
					'priority',
					'ratio',
					'url',
				]),
				expiresAt: new Date(ps.expiresAt),
				startsAt: new Date(ps.startsAt),
			});
		});
	}
}
