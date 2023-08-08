import { z } from 'zod';
import { Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import { FlashEntityService } from '@/core/entities/FlashEntityService.js';
import { FlashSchema } from '@/models/zod/FlashSchema.js';
import { PrismaService } from '@/core/PrismaService.js';

const res = z.array(FlashSchema);
export const meta = {
	tags: ['flash'],
	requireCredential: false,
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
		private readonly flashEntityService: FlashEntityService,
		private readonly prismaService: PrismaService,
	) {
		super(meta, paramDef, async (ps, me) => {
			const flashs = await this.prismaService.client.flash.findMany({
				where: { likedCount: { gt: 0 } },
				orderBy: { likedCount: 'desc' },
				take: 10,
			});

			return (await Promise.all(
				flashs.map((flash) => this.flashEntityService.pack(flash, me)),
			)) satisfies z.infer<typeof res>;
		});
	}
}
