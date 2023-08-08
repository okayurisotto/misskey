import { z } from 'zod';
import { Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import { IdService } from '@/core/IdService.js';
import { PrismaService } from '@/core/PrismaService.js';

export const meta = {
	tags: ['admin'],
	requireCredential: true,
	requireModerator: true,
} as const;

export const paramDef = z.object({
	url: z.string().min(1),
	memo: z.string(),
	place: z.string(),
	priority: z.string(),
	ratio: z.number().int(),
	expiresAt: z.number().int(),
	startsAt: z.number().int(),
	imageUrl: z.string().min(1),
	dayOfWeek: z.number().int(),
});

@Injectable()
// eslint-disable-next-line import/no-default-export
export default class extends Endpoint<
	typeof meta,
	typeof paramDef,
	z.ZodType<void>
> {
	constructor(
		private readonly idService: IdService,
		private readonly prismaService: PrismaService,
	) {
		super(meta, paramDef, async (ps) => {
			await this.prismaService.client.ad.create({
				data: {
					id: this.idService.genId(),
					createdAt: new Date(),
					expiresAt: new Date(ps.expiresAt),
					startsAt: new Date(ps.startsAt),
					dayOfWeek: ps.dayOfWeek,
					url: ps.url,
					imageUrl: ps.imageUrl,
					priority: ps.priority,
					ratio: ps.ratio,
					place: ps.place,
					memo: ps.memo,
				},
			});
		});
	}
}
