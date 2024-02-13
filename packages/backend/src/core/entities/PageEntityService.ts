import { Injectable } from '@nestjs/common';
import { z } from 'zod';
import { awaitAll } from '@/misc/prelude/await-all.js';
import type { PageSchema } from '@/models/zod/PageSchema.js';
import { PrismaService } from '@/core/PrismaService.js';
import { PageContentSchema } from '@/models/zod/PageContentSchema.js';
import { isNotNull } from '@/misc/is-not-null.js';
import { DriveFileEntityPackService } from './DriveFileEntityPackService.js';
import { UserEntityPackLiteService } from './UserEntityPackLiteService.js';
import type { DriveFile, Page, User } from '@prisma/client';

@Injectable()
export class PageEntityService {
	constructor(
		private readonly driveFileEntityPackService: DriveFileEntityPackService,
		private readonly prismaService: PrismaService,
		private readonly userEntityPackLiteService: UserEntityPackLiteService,
	) {}

	/**
	 * `page`をpackする。
	 *
	 * @param src
	 * @param me
	 * @returns
	 */
	public async pack(
		src: Page['id'] | Page,
		me?: { id: User['id'] } | null | undefined,
	): Promise<z.infer<typeof PageSchema>> {
		const meId = me ? me.id : null;
		const page = await this.prismaService.client.page.findUniqueOrThrow({
			where: { id: typeof src === 'string' ? src : src.id },
			include: { user: true, _count: { select: { likes: true } } },
		});

		const collectFiles = (
			xs: z.infer<typeof PageContentSchema>,
			userId: string,
		): Promise<DriveFile | null>[] => {
			return xs
				.map((x) => {
					return [
						...(x.type === 'image' && x.fileId !== undefined
							? [
									this.prismaService.client.driveFile.findUnique({
										where: { id: x.fileId, userId },
									}),
							  ]
							: []),
						...('children' in x && x.children !== undefined
							? collectFiles(x.children, userId)
							: []),
					];
				})
				.flat();
		};

		const content = PageContentSchema.parse(page.content);
		const attachedFiles = collectFiles(content, page.userId);

		const result = await awaitAll({
			user: () => this.userEntityPackLiteService.packLite(page.user),
			eyeCatchingImage: () =>
				page.eyeCatchingImageId
					? this.driveFileEntityPackService.pack(page.eyeCatchingImageId)
					: Promise.resolve(null),
			attachedFiles: async () =>
				this.driveFileEntityPackService.packMany(
					(await Promise.all(attachedFiles)).filter(isNotNull),
				),
			isLiked: async () =>
				meId
					? (await this.prismaService.client.pageLike.count({
							where: { pageId: page.id, userId: meId },
							take: 1,
					  })) > 0
					: undefined,
		});

		return {
			id: page.id,
			createdAt: page.createdAt.toISOString(),
			updatedAt: page.updatedAt.toISOString(),
			userId: page.userId,
			user: result.user,
			content: content,
			variables: [],
			title: page.title,
			name: page.name,
			summary: page.summary,
			hideTitleWhenPinned: page.hideTitleWhenPinned,
			alignCenter: page.alignCenter,
			font: page.font,
			script: page.script,
			eyeCatchingImageId: page.eyeCatchingImageId,
			eyeCatchingImage: result.eyeCatchingImage,
			attachedFiles: result.attachedFiles,
			likedCount: page._count.likes,
			isLiked: result.isLiked,
		};
	}
}
