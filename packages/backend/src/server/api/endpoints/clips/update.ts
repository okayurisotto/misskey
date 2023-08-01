import { z } from 'zod';
import { Inject, Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import type { ClipsRepository } from '@/models/index.js';
import { ClipEntityService } from '@/core/entities/ClipEntityService.js';
import { DI } from '@/di-symbols.js';
import { ClipSchema } from '@/models/zod/ClipSchema.js';
import { ApiError } from '../../error.js';
import { misskeyIdPattern } from '@/models/zod/misc.js';

const res = ClipSchema;
export const meta = {
	tags: ['clips'],
	requireCredential: true,
	prohibitMoved: true,
	kind: 'write:account',
	errors: {
		noSuchClip: {
			message: 'No such clip.',
			code: 'NO_SUCH_CLIP',
			id: 'b4d92d70-b216-46fa-9a3f-a8c811699257',
		},
	},
	res,
} as const;

export const paramDef = z.object({
	clipId: misskeyIdPattern,
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
		@Inject(DI.clipsRepository)
		private clipsRepository: ClipsRepository,

		private clipEntityService: ClipEntityService,
	) {
		super(meta, paramDef, async (ps, me) => {
			// Fetch the clip
			const clip = await this.clipsRepository.findOneBy({
				id: ps.clipId,
				userId: me.id,
			});

			if (clip == null) {
				throw new ApiError(meta.errors.noSuchClip);
			}

			await this.clipsRepository.update(clip.id, {
				name: ps.name,
				description: ps.description,
				isPublic: ps.isPublic,
			});

			return (await this.clipEntityService.pack(clip.id, me)) satisfies z.infer<
				typeof res
			>;
		});
	}
}
