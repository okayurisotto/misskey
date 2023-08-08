import { z } from 'zod';
import { Injectable } from '@nestjs/common';
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
		noSuchFlash: {
			message: 'No such flash.',
			code: 'NO_SUCH_FLASH',
			id: 'c07c1491-9161-4c5c-9d75-01906f911f73',
		},
		yourFlash: {
			message: 'You cannot like your flash.',
			code: 'YOUR_FLASH',
			id: '3fd8a0e7-5955-4ba9-85bb-bf3e0c30e13b',
		},
		alreadyLiked: {
			message: 'The flash has already been liked.',
			code: 'ALREADY_LIKED',
			id: '010065cf-ad43-40df-8067-abff9f4686e3',
		},
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
				(await this.prismaService.client.flash_like.count({
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
			await this.prismaService.client.flash_like.create({
				data: {
					id: this.idService.genId(),
					createdAt: new Date(),
					flashId: flash.id,
					userId: me.id,
				},
			});

			await this.prismaService.client.flash.update({
				where: { id: flash.id },
				data: { likedCount: { increment: 1 } },
			});
		});
	}
}
