import { noSuchClip_ } from '@/server/api/errors.js';
import { z } from 'zod';
import { Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import { MisskeyIdSchema } from '@/models/zod/misc.js';
import { PrismaService } from '@/core/PrismaService.js';
import { ApiError } from '../../error.js';

export const meta = {
	tags: ['clips'],
	requireCredential: true,
	kind: 'write:account',
	errors: {noSuchClip:noSuchClip_},
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
				where: {
					id: ps.clipId,
					userId: me.id,
				},
			});

			if (clip == null) {
				throw new ApiError(meta.errors.noSuchClip);
			}

			await this.prismaService.client.clip.delete({ where: { id: clip.id } });
		});
	}
}
