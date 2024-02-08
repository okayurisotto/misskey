import { z } from 'zod';
import { Injectable } from '@nestjs/common';
import { noSuchFlash_, yourFlash, alreadyLiked } from '@/server/api/errors.js';
import { IdService } from '@/core/IdService.js';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import { MisskeyIdSchema } from '@/models/zod/misc.js';
import { PrismaService } from '@/core/PrismaService.js';
import { ApiError } from '../../error.js';

export const meta = {
	tags: ['flash'],
	requireCredential: true,
	prohibitMoved: true,
	kind: 'write:flash-likes',
	errors: {
		noSuchFlash: noSuchFlash_,
		yourFlash: yourFlash,
		alreadyLiked: alreadyLiked,
	},
} as const;

export const paramDef = z.object({
	flashId: MisskeyIdSchema,
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
		super(meta, paramDef, async (ps, me) => {
			const flash = await this.prismaService.client.flash.findUnique({
				where: { id: ps.flashId },
			});
			if (flash == null) {
				throw new ApiError(meta.errors.noSuchFlash);
			}

			if (flash.userId === me.id) {
				throw new ApiError(meta.errors.yourFlash);
			}

			// if already liked
			const exist =
				(await this.prismaService.client.flashLike.count({
					where: {
						flashId: flash.id,
						userId: me.id,
					},
					take: 1,
				})) > 0;

			if (exist) {
				throw new ApiError(meta.errors.alreadyLiked);
			}

			// Create like
			await this.prismaService.client.flashLike.create({
				data: {
					id: this.idService.genId(),
					createdAt: new Date(),
					flashId: flash.id,
					userId: me.id,
				},
			});
		});
	}
}
