import { z } from 'zod';
import { Injectable } from '@nestjs/common';
import { noSuchClip______, notFavorited } from '@/server/api/errors.js';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import { MisskeyIdSchema } from '@/models/zod/misc.js';
import { PrismaService } from '@/core/PrismaService.js';
import { ApiError } from '../../error.js';

export const meta = {
	tags: ['clip'],
	requireCredential: true,
	prohibitMoved: true,
	kind: 'write:clip-favorite',
	errors: {noSuchClip:noSuchClip______,notFavorited:notFavorited},
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
