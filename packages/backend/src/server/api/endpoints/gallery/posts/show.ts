import { z } from 'zod';
import { Inject, Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import type { GalleryPostsRepository } from '@/models/index.js';
import { GalleryPostEntityService } from '@/core/entities/GalleryPostEntityService.js';
import { DI } from '@/di-symbols.js';
import { GalleryPostSchema } from '@/models/zod/GalleryPostSchema.js';
import { misskeyIdPattern } from '@/models/zod/misc.js';
import { ApiError } from '../../../error.js';

const res = GalleryPostSchema;
export const meta = {
	tags: ['gallery'],
	requireCredential: false,
	errors: {
		noSuchPost: {
			message: 'No such post.',
			code: 'NO_SUCH_POST',
			id: '1137bf14-c5b0-4604-85bb-5b5371b1cd45',
		},
	},
	res,
} as const;

export const paramDef = z.object({
	postId: misskeyIdPattern,
});

@Injectable()
// eslint-disable-next-line import/no-default-export
export default class extends Endpoint<
	typeof meta,
	typeof paramDef,
	typeof res
> {
	constructor(
		@Inject(DI.galleryPostsRepository)
		private galleryPostsRepository: GalleryPostsRepository,

		private galleryPostEntityService: GalleryPostEntityService,
	) {
		super(meta, paramDef, async (ps, me) => {
			const post = await this.galleryPostsRepository.findOneBy({
				id: ps.postId,
			});

			if (post == null) {
				throw new ApiError(meta.errors.noSuchPost);
			}

			return (await this.galleryPostEntityService.pack(
				post,
				me,
			)) satisfies z.infer<typeof res>;
		});
	}
}
