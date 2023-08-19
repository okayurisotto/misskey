import { noSuchClip_______ } from '@/server/api/errors.js';
import { z } from 'zod';
import { Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import { ClipEntityService } from '@/core/entities/ClipEntityService.js';
import { ClipSchema } from '@/models/zod/ClipSchema.js';
import { MisskeyIdSchema } from '@/models/zod/misc.js';
import { PrismaService } from '@/core/PrismaService.js';
import { ApiError } from '../../error.js';

const res = ClipSchema;
export const meta = {
	tags: ['clips'],
	requireCredential: true,
	prohibitMoved: true,
	kind: 'write:account',
	errors: {noSuchClip:noSuchClip_______},
	res,
} as const;

export const paramDef = z.object({
	clipId: MisskeyIdSchema,
	name: z.string().min(1).max(100),
	isPublic: z.boolean().optional(),
	description: z.string().min(1).max(2048).nullable().optional(),
});

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
			// Fetch the clip
			const clip = await this.prismaService.client.clip.findUnique({
				where: {
					id: ps.clipId,
					userId: me.id,
				},
			});

			if (clip == null) {
				throw new ApiError(meta.errors.noSuchClip);
			}

			await this.prismaService.client.clip.update({
				where: { id: clip.id },
				data: {
					name: ps.name,
					description: ps.description,
					isPublic: ps.isPublic,
				},
			});

			return (await this.clipEntityService.pack(clip.id, me)) satisfies z.infer<
				typeof res
			>;
		});
	}
}
