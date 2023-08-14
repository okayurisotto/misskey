import { Injectable } from '@nestjs/common';
import { bindThis } from '@/decorators.js';
import { PrismaService } from '@/core/PrismaService.js';
import type { GalleryPostSchema } from '@/models/zod/GalleryPostSchema.js';
import { GalleryPostEntityService } from './GalleryPostEntityService.js';
import type { gallery_like, user } from '@prisma/client';
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
	@bindThis
	public async pack(
		src: gallery_like['id'] | gallery_like,
		me?: { id: user['id'] } | null | undefined,
	): Promise<{ id: string; post: z.infer<typeof GalleryPostSchema> }> {
		const like = typeof src === 'object'
			? src
			: await this.prismaService.client.gallery_like.findUniqueOrThrow({ where: { id: src } });

		return {
			id: like.id,
			post: await this.galleryPostEntityService.pack(like.postId, me),
		};
	}
}
