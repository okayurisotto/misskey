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
	tags: ['clips', 'account'],
	requireCredential: false,
	kind: 'read:account',
	errors: {
		noSuchClip: {
			message: 'No such clip.',
			code: 'NO_SUCH_CLIP',
			id: 'c3c5fe33-d62c-44d2-9ea5-d997703f5c20',
		},
	},
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
