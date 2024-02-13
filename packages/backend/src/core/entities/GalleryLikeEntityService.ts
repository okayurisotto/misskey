import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/core/PrismaService.js';
import type { GalleryPostSchema } from '@/models/zod/GalleryPostSchema.js';
import { GalleryPostEntityService } from './GalleryPostEntityService.js';
import type { GalleryLike, User } from '@prisma/client';
import type { z } from 'zod';

@Injectable()
export class GalleryLikeEntityService {
	constructor(
		private readonly galleryPostEntityService: GalleryPostEntityService,
		private readonly prismaService: PrismaService,
	) {}

	/**
	 * `gallery_like`をpackする。
	 *
	 * @param src
	 * @param me
	 * @returns
	 */
	public async pack(
		src: GalleryLike['id'] | GalleryLike,
		me?: { id: User['id'] } | null | undefined,
	): Promise<{ id: string; post: z.infer<typeof GalleryPostSchema> }> {
		const like =
			typeof src === 'object'
				? src
				: await this.prismaService.client.galleryLike.findUniqueOrThrow({
						where: { id: src },
				  });

		return {
			id: like.id,
			post: await this.galleryPostEntityService.pack(like.galleryId, me),
		};
	}
}
