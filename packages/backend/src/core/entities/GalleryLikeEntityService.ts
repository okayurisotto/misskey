import { Inject, Injectable } from '@nestjs/common';
import { DI } from '@/di-symbols.js';
import type { GalleryLikesRepository } from '@/models/index.js';
import type {} from '@/models/entities/Blocking.js';
import type { GalleryLike } from '@/models/entities/GalleryLike.js';
import { bindThis } from '@/decorators.js';
import { GalleryPostEntityService } from './GalleryPostEntityService.js';

@Injectable()
export class GalleryLikeEntityService {
	constructor(
		@Inject(DI.galleryLikesRepository)
		private galleryLikesRepository: GalleryLikesRepository,

		private galleryPostEntityService: GalleryPostEntityService,
	) {}

	@bindThis
	public async pack(src: GalleryLike['id'] | GalleryLike, me?: any) {
		const like =
			typeof src === 'object'
				? src
				: await this.galleryLikesRepository.findOneByOrFail({ id: src });

		return {
			id: like.id,
			post: await this.galleryPostEntityService.pack(
				like.post ?? like.postId,
				me,
			),
		};
	}
}
