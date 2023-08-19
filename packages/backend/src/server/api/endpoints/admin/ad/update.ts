import { noSuchAd_ } from '@/server/api/errors.js';
import { z } from 'zod';
import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import { PrismaService } from '@/core/PrismaService.js';
import { AdSchema } from '@/models/zod/AdSchema.js';
import { ApiError } from '../../../error.js';

export const meta = {
	tags: ['admin'],
	requireCredential: true,
	requireModerator: true,
	errors: {noSuchAd:noSuchAd_},
} as const;

export const paramDef = AdSchema;

@Injectable()
// eslint-disable-next-line import/no-default-export
export default class extends Endpoint<
	typeof meta,
	typeof paramDef,
	z.ZodType<void>
> {
	constructor(private readonly prismaService: PrismaService) {
		super(meta, paramDef, async (ps) => {
			try {
				await this.prismaService.client.ad.update({
					where: { id: ps.id },
					data: {
						url: ps.url,
						place: ps.place,
						priority: ps.priority,
						ratio: ps.ratio,
						memo: ps.memo,
						imageUrl: ps.imageUrl,
						expiresAt: new Date(ps.expiresAt),
						startsAt: new Date(ps.startsAt),
						dayOfWeek: ps.dayOfWeek,
					},
				});
			} catch (e) {
				if (e instanceof Prisma.PrismaClientKnownRequestError) {
					if (e.code === 'P2025') {
						throw new ApiError(meta.errors.noSuchAd);
					}
				}

				throw e;
			}
		});
	}
}
