import { noSuchClip__, alreadyFavorited } from '@/server/api/errors.js';
import { z } from 'zod';
import { Injectable } from '@nestjs/common';
import { IdService } from '@/core/IdService.js';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import { MisskeyIdSchema } from '@/models/zod/misc.js';
import { PrismaService } from '@/core/PrismaService.js';
import { ApiError } from '../../error.js';

export const meta = {
	tags: ['clip'],
	requireCredential: true,
	prohibitMoved: true,
	kind: 'write:clip-favorite',
	errors: {noSuchClip:noSuchClip__,alreadyFavorited:alreadyFavorited},
} as const;

export const paramDef = z.object({ clipId: MisskeyIdSchema });

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
			const clip = await this.prismaService.client.clip.findUnique({
				where: { id: ps.clipId },
			});
			if (clip == null) {
				throw new ApiError(meta.errors.noSuchClip);
			}
			if (clip.userId !== me.id && !clip.isPublic) {
				throw new ApiError(meta.errors.noSuchClip);
			}

			const exist =
				(await this.prismaService.client.clip_favorite.count({
					where: {
						clipId: clip.id,
						userId: me.id,
					},
					take: 1,
				})) > 0;

			if (exist) {
				throw new ApiError(meta.errors.alreadyFavorited);
			}

			await this.prismaService.client.clip_favorite.create({
				data: {
					id: this.idService.genId(),
					createdAt: new Date(),
					clipId: clip.id,
					userId: me.id,
				},
			});
		});
	}
}
