import { Injectable } from '@nestjs/common';
import { awaitAll } from '@/misc/prelude/await-all.js';
import type {} from '@/models/entities/Blocking.js';
import type { User } from '@/models/entities/User.js';
import type { GalleryPost } from '@/models/entities/GalleryPost.js';
import { bindThis } from '@/decorators.js';
import type { GalleryPostSchema } from '@/models/zod/GalleryPostSchema.js';
import { PrismaService } from '@/core/PrismaService.js';
import { UserEntityService } from './UserEntityService.js';
import { DriveFileEntityService } from './DriveFileEntityService.js';
import type { z } from 'zod';
import type { gallery_post } from '@prisma/client';

@Injectable()
export class GalleryPostEntityService {
	constructor(
		private readonly driveFileEntityService: DriveFileEntityService,
		private readonly prismaService: PrismaService,
		private readonly userEntityService: UserEntityService,
	) {}

	@bindThis
	public async pack(
		src: GalleryPost['id'] | gallery_post,
		me?: { id: User['id'] } | null | undefined,
	): Promise<z.infer<typeof GalleryPostSchema>> {
		const meId = me ? me.id : null;
		const post =
			typeof src === 'object'
				? src
				: await this.prismaService.client.gallery_post.findUniqueOrThrow({ where: { id: src } });

		const result = await awaitAll({
			user: () => this.userEntityService.pack(post.userId, me),
			files: () => this.driveFileEntityService.packManyByIds(post.fileIds), // TODO: packMany causes N+1 queries
			isLiked: async () =>
				meId
					? (await this.prismaService.client.gallery_like.count({
							where: { postId: post.id, userId: meId },
							take: 1,
					  })) > 0
					: undefined,
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
