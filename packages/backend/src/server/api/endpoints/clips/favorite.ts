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
	errors: {
		noSuchClip: {
			message: 'No such clip.',
			code: 'NO_SUCH_CLIP',
			id: '4c2aaeae-80d8-4250-9606-26cb1fdb77a5',
		},
		alreadyFavorited: {
			message: 'The clip has already been favorited.',
			code: 'ALREADY_FAVORITED',
			id: '92658936-c625-4273-8326-2d790129256e',
		},
	},
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
