import { z } from 'zod';
import { Injectable } from '@nestjs/common';
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
			id: '2603966e-b865-426c-94a7-af4a01241dc1',
		},
		notFavorited: {
			message: 'You have not favorited the clip.',
			code: 'NOT_FAVORITED',
			id: '90c3a9e8-b321-4dae-bf57-2bf79bbcc187',
		},
	},
} as const;

export const paramDef = z.object({
	clipId: MisskeyIdSchema,
});

@Injectable()
// eslint-disable-next-line import/no-default-export
export default class extends Endpoint<
	typeof meta,
	typeof paramDef,
	z.ZodType<void>
> {
	constructor(private readonly prismaService: PrismaService) {
		super(meta, paramDef, async (ps, me) => {
			const clip = await this.prismaService.client.clip.findUnique({
				where: { id: ps.clipId },
			});
			if (clip == null) {
				throw new ApiError(meta.errors.noSuchClip);
			}

			const exist = await this.prismaService.client.clip_favorite.findUnique({
				where: {
					userId_clipId: {
						clipId: clip.id,
						userId: me.id,
					},
				},
			});

			if (exist == null) {
				throw new ApiError(meta.errors.notFavorited);
			}

			await this.prismaService.client.clip_favorite.delete({
				where: { id: exist.id },
			});
		});
	}
}
