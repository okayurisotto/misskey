import { z } from 'zod';
import { Injectable } from '@nestjs/common';
import { noSuchFlash___, notLiked } from '@/server/api/errors.js';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import { MisskeyIdSchema } from '@/models/zod/misc.js';
import { PrismaService } from '@/core/PrismaService.js';
import { ApiError } from '../../error.js';

export const meta = {
	tags: ['flash'],
	requireCredential: true,
	prohibitMoved: true,
	kind: 'write:flash-likes',
	errors: { noSuchFlash: noSuchFlash___, notLiked: notLiked },
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
	constructor(private readonly prismaService: PrismaService) {
		super(meta, paramDef, async (ps, me) => {
			const flash = await this.prismaService.client.flash.findUnique({
				where: { id: ps.flashId },
			});
			if (flash == null) {
				throw new ApiError(meta.errors.noSuchFlash);
			}

			const exist = await this.prismaService.client.flash_like.findUnique({
				where: {
					userId_flashId: {
						flashId: flash.id,
						userId: me.id,
					},
				},
			});

			if (exist == null) {
				throw new ApiError(meta.errors.notLiked);
			}

			// Delete like
			await this.prismaService.client.flash_like.delete({
				where: { id: exist.id },
			});
		});
	}
}
