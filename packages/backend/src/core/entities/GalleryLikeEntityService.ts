import { Injectable } from '@nestjs/common';
import type {} from '@/models/entities/Blocking.js';
import type { GalleryLike } from '@/models/entities/GalleryLike.js';
import { bindThis } from '@/decorators.js';
import type { T2P } from '@/types.js';
import { PrismaService } from '@/core/PrismaService.js';
import { GalleryPostEntityService } from './GalleryPostEntityService.js';
import type { gallery_like } from '@prisma/client';

@Injectable()
export class GalleryLikeEntityService {
	constructor(
		private readonly galleryPostEntityService: GalleryPostEntityService,
		private readonly prismaService: PrismaService,
	) {}

	@bindThis
	public async pack(
		src: GalleryLike['id'] | T2P<GalleryLike, gallery_like>,
		me?: any,
	) {
		const like =
			typeof src === 'object'
				? src
				: await this.prismaService.client.gallery_like.findUniqueOrThrow({ where: { id: src } });

		return {
			id: like.id,
			post: await this.galleryPostEntityService.pack(like.postId, me),
		};
	}
}
