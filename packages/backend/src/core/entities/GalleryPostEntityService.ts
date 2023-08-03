import { Inject, Injectable } from '@nestjs/common';
import { DI } from '@/di-symbols.js';
import type {
	GalleryLikesRepository,
	GalleryPostsRepository,
} from '@/models/index.js';
import { awaitAll } from '@/misc/prelude/await-all.js';
import type {} from '@/models/entities/Blocking.js';
import type { User } from '@/models/entities/User.js';
import type { GalleryPost } from '@/models/entities/GalleryPost.js';
import { bindThis } from '@/decorators.js';
import type { GalleryPostSchema } from '@/models/zod/GalleryPostSchema.js';
import { UserEntityService } from './UserEntityService.js';
import { DriveFileEntityService } from './DriveFileEntityService.js';
import type { z } from 'zod';

@Injectable()
export class GalleryPostEntityService {
	constructor(
		@Inject(DI.galleryPostsRepository)
		private galleryPostsRepository: GalleryPostsRepository,

		@Inject(DI.galleryLikesRepository)
		private galleryLikesRepository: GalleryLikesRepository,

		private userEntityService: UserEntityService,
		private driveFileEntityService: DriveFileEntityService,
	) {}

	@bindThis
	public async pack(
		src: GalleryPost['id'] | GalleryPost,
		me?: { id: User['id'] } | null | undefined,
	): Promise<z.infer<typeof GalleryPostSchema>> {
		const meId = me ? me.id : null;
		const post =
			typeof src === 'object'
				? src
				: await this.galleryPostsRepository.findOneByOrFail({ id: src });

		const result = await awaitAll({
			user: () => this.userEntityService.pack(post.user ?? post.userId, me),
			files: () => this.driveFileEntityService.packManyByIds(post.fileIds), // TODO: packMany causes N+1 queries
			isLiked: () =>
				meId
					? this.galleryLikesRepository.exist({
							where: { postId: post.id, userId: meId },
					  })
					: Promise.resolve(undefined),
		});

		return {
			id: post.id,
			createdAt: post.createdAt.toISOString(),
			updatedAt: post.updatedAt.toISOString(),
			userId: post.userId,
			user: result.user,
			title: post.title,
			description: post.description,
			fileIds: post.fileIds,
			files: result.files,
			tags: post.tags.length > 0 ? post.tags : undefined,
			isSensitive: post.isSensitive,
			likedCount: post.likedCount,
			isLiked: result.isLiked,
		};
	}
}
