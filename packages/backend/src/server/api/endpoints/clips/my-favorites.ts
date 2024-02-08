import { z } from 'zod';
import { Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import { ClipEntityService } from '@/core/entities/ClipEntityService.js';
import { ClipSchema } from '@/models/zod/ClipSchema.js';
import { PrismaService } from '@/core/PrismaService.js';

const res = z.array(ClipSchema);
export const meta = {
	tags: ['account', 'clip'],
	requireCredential: true,
	kind: 'read:clip-favorite',
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
		private readonly clipEntityService: ClipEntityService,
		private readonly prismaService: PrismaService,
	) {
		super(meta, paramDef, async (ps, me) => {
			const favorites = await this.prismaService.client.clipFavorite.findMany({
				where: { userId: me.id },
				include: { clip: true },
			});

			return await Promise.all(
				favorites.map((favorite) =>
					this.clipEntityService.pack(favorite.clip, me),
				),
			);
		});
	}
}
