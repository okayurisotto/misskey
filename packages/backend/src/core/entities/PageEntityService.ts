import { Injectable } from '@nestjs/common';
import { z } from 'zod';
import { awaitAll } from '@/misc/prelude/await-all.js';
import type { User } from '@/models/entities/User.js';
import type { Page } from '@/models/entities/Page.js';
import type { DriveFile } from '@/models/entities/DriveFile.js';
import { bindThis } from '@/decorators.js';
import type { PageSchema } from '@/models/zod/PageSchema.js';
import type { T2P } from '@/types.js';
import { PrismaService } from '@/core/PrismaService.js';
import { UserEntityService } from './UserEntityService.js';
import { DriveFileEntityService } from './DriveFileEntityService.js';
import type { drive_file, page } from '@prisma/client';

@Injectable()
export class PageEntityService {
	constructor(
		private readonly driveFileEntityService: DriveFileEntityService,
		private readonly prismaService: PrismaService,
		private readonly userEntityService: UserEntityService,
	) {}

	@bindThis
	public async pack(
		src: Page['id'] | T2P<Page, page>,
		me?: { id: User['id'] } | null | undefined,
	): Promise<z.infer<typeof PageSchema>> {
		const meId = me ? me.id : null;
		const page =
			typeof src === 'object'
				? src
				: await this.prismaService.client.page.findUniqueOrThrow({ where: { id: src } });

		const attachedFiles: Promise<T2P<DriveFile, drive_file> | null>[] = [];
		const collectFile = (xs: any[]) => {
			for (const x of xs) {
				if (x.type === 'image') {
					attachedFiles.push(
						this.prismaService.client.drive_file.findUnique({
							where: {
								id: x.fileId,
								userId: page.userId,
							},
						}),
					);
				}
				if (x.children) {
					collectFile(x.children);
				}
			}
		};
		collectFile(z.array(z.record(z.string(), z.any())).parse(page.content));

		// 後方互換性のため
		let migrated = false;
		const migrate = (xs: any[]) => {
			for (const x of xs) {
				if (x.type === 'input') {
					if (x.inputType === 'text') {
						x.type = 'textInput';
					}
					if (x.inputType === 'number') {
						x.type = 'numberInput';
						if (x.default) x.default = parseInt(x.default, 10);
					}
					migrated = true;
				}
				if (x.children) {
					migrate(x.children);
				}
			}
		};
		migrate(z.array(z.record(z.string(), z.any())).parse(page.content));
		if (migrated) {
			this.prismaService.client.page.update({
				where: { id: page.id },
				data: {
					content: z.array(z.record(z.string(), z.any())).parse(page.content),
				},
			});
		}

		const result = await awaitAll({
			user: () => this.userEntityService.pack(page.userId, me), // { detail: true } すると無限ループするので注意
			eyeCatchingImage: () =>
				page.eyeCatchingImageId
					? this.driveFileEntityService.pack(page.eyeCatchingImageId)
					: Promise.resolve(null),
			attachedFiles: async () =>
				this.driveFileEntityService.packMany(
					(await Promise.all(attachedFiles)).filter(
						(x): x is DriveFile => x != null,
					),
				),
			isLiked: async () =>
				meId
					? await this.prismaService.client.page_like.count({
							where: { pageId: page.id, userId: meId },
							take: 1,
					  }) > 0
					: undefined,
		});

		return {
			id: page.id,
			createdAt: page.createdAt.toISOString(),
			updatedAt: page.updatedAt.toISOString(),
			userId: page.userId,
			user: result.user,
			content: z.array(z.record(z.string(), z.any())).parse(page.content),
			variables: z.array(z.record(z.string(), z.any())).parse(page.variables),
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
			likedCount: page.likedCount,
			isLiked: result.isLiked,
		};
	}
}
