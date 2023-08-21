import { z } from 'zod';
import { Injectable } from '@nestjs/common';
import { noSuchClip_____ } from '@/server/api/errors.js';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import { ClipEntityService } from '@/core/entities/ClipEntityService.js';
import { ClipSchema } from '@/models/zod/ClipSchema.js';
import { MisskeyIdSchema } from '@/models/zod/misc.js';
import { PrismaService } from '@/core/PrismaService.js';
import { ApiError } from '../../error.js';

const res = ClipSchema;
export const meta = {
	tags: ['clips', 'account'],
	requireCredential: false,
	kind: 'read:account',
	errors: {noSuchClip:noSuchClip_____},
	res,
} as const;

export const paramDef = z.object({
	clipId: MisskeyIdSchema,
});

@Injectable()
// eslint-disable-next-line import/no-default-export
export default class extends Endpoint<
	typeof meta,
	typeof paramDef,
	typeof res
> {
	constructor(
		private clipEntityService: ClipEntityService,
		private prismaService: PrismaService,
	) {
		super(meta, paramDef, async (ps, me) => {
			// Fetch the clip
			const clip = await this.prismaService.client.clip.findUnique({
				where: { id: ps.clipId },
			});

			if (clip == null) {
				throw new ApiError(meta.errors.noSuchClip);
			}

			if (!clip.isPublic && (me == null || clip.userId !== me.id)) {
				throw new ApiError(meta.errors.noSuchClip);
			}

			return (await this.clipEntityService.pack(clip, me)) satisfies z.infer<
				typeof res
			>;
		});
	}
}
