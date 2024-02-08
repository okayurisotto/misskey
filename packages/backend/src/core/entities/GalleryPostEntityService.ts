import { Injectable } from '@nestjs/common';
import { awaitAll } from '@/misc/prelude/await-all.js';
import type { GalleryPostSchema } from '@/models/zod/GalleryPostSchema.js';
import { PrismaService } from '@/core/PrismaService.js';
import { DriveFileEntityPackService } from './DriveFileEntityPackService.js';
import { UserEntityPackLiteService } from './UserEntityPackLiteService.js';
import type { z } from 'zod';
import type { Gallery, user } from '@prisma/client';

@Injectable()
export class GalleryPostEntityService {
	constructor(
		private readonly driveFileEntityPackService: DriveFileEntityPackService,
		private readonly prismaService: PrismaService,
		private readonly userEntityPackLiteService: UserEntityPackLiteService,
	) {}

	/**
	 * `Gallery`をpackする。
	 *
	 * @param src
	 * @param me 渡された場合、返り値の`isLiked`が`boolean`になる。
	 * @returns
	 */
	public async pack(
		src: Gallery['id'] | Gallery,
		me?: { id: user['id'] } | null | undefined,
	): Promise<z.infer<typeof GalleryPostSchema>> {
		const meId = me ? me.id : null;
		const post = await this.prismaService.client.gallery.findUniqueOrThrow({
			where: { id: typeof src === 'string' ? src : src.id },
			include: { user: true, _count: { select: { likes: true } } },
		});

		const result = await awaitAll({
			user: () => this.userEntityPackLiteService.packLite(post.user),
			files: () => this.driveFileEntityPackService.packManyByIds(post.fileIds),
			isLiked: async () =>
				meId
					? (await this.prismaService.client.galleryLike.count({
							where: { galleryId: post.id, userId: meId },
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
			likedCount: post._count.likes,
			isLiked: result.isLiked,
		};
	}
}
