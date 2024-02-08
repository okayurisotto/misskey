import { z } from 'zod';
import { Injectable } from '@nestjs/common';
import { noSuchPost__ } from '@/server/api/errors.js';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import { GalleryPostEntityService } from '@/core/entities/GalleryPostEntityService.js';
import { GalleryPostSchema } from '@/models/zod/GalleryPostSchema.js';
import { MisskeyIdSchema } from '@/models/zod/misc.js';
import { PrismaService } from '@/core/PrismaService.js';
import { ApiError } from '../../../error.js';

const res = GalleryPostSchema;
export const meta = {
	tags: ['gallery'],
	requireCredential: false,
	errors: { noSuchPost: noSuchPost__ },
	res,
} as const;

export const paramDef = z.object({
	postId: MisskeyIdSchema,
});

@Injectable()
// eslint-disable-next-line import/no-default-export
export default class extends Endpoint<
	typeof meta,
	typeof paramDef,
	typeof res
> {
	constructor(
		private readonly galleryPostEntityService: GalleryPostEntityService,
		private readonly prismaService: PrismaService,
	) {
		super(meta, paramDef, async (ps, me) => {
			const post = await this.prismaService.client.gallery.findUnique({
				where: { id: ps.postId },
			});

			if (post === null) {
				throw new ApiError(meta.errors.noSuchPost);
			}

			return await this.galleryPostEntityService.pack(post, me);
		});
	}
}
