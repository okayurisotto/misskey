import { Inject, Injectable } from '@nestjs/common';
import { DI } from '@/di-symbols.js';
import type {
	DriveFilesRepository,
	PagesRepository,
	PageLikesRepository,
} from '@/models/index.js';
import { awaitAll } from '@/misc/prelude/await-all.js';
import type {} from '@/models/entities/Blocking.js';
import type { User } from '@/models/entities/User.js';
import type { Page } from '@/models/entities/Page.js';
import type { DriveFile } from '@/models/entities/DriveFile.js';
import { bindThis } from '@/decorators.js';
import type { PageSchema } from '@/models/zod/PageSchema.js';
import { UserEntityService } from './UserEntityService.js';
import { DriveFileEntityService } from './DriveFileEntityService.js';
import type { z } from 'zod';

@Injectable()
export class PageEntityService {
	constructor(
		@Inject(DI.pagesRepository)
		private pagesRepository: PagesRepository,

		@Inject(DI.pageLikesRepository)
		private pageLikesRepository: PageLikesRepository,

		@Inject(DI.driveFilesRepository)
		private driveFilesRepository: DriveFilesRepository,

		private userEntityService: UserEntityService,
		private driveFileEntityService: DriveFileEntityService,
	) {}

	@bindThis
	public async pack(
		src: Page['id'] | Page,
		me?: { id: User['id'] } | null | undefined,
	): Promise<z.infer<typeof PageSchema>> {
		const meId = me ? me.id : null;
		const page =
			typeof src === 'object'
				? src
				: await this.pagesRepository.findOneByOrFail({ id: src });

		const attachedFiles: Promise<DriveFile | null>[] = [];
		const collectFile = (xs: any[]) => {
			for (const x of xs) {
				if (x.type === 'image') {
					attachedFiles.push(
						this.driveFilesRepository.findOneBy({
							id: x.fileId,
							userId: page.userId,
						}),
					);
				}
				if (x.children) {
					collectFile(x.children);
				}
			}
		};
		collectFile(page.content);

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
		migrate(page.content);
		if (migrated) {
			this.pagesRepository.update(page.id, {
				content: page.content,
			});
		}

		const result = await awaitAll({
			user: () => this.userEntityService.pack(page.user ?? page.userId, me), // { detail: true } すると無限ループするので注意
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
			isLiked: () =>
				meId
					? this.pageLikesRepository.exist({
							where: { pageId: page.id, userId: meId },
					  })
					: Promise.resolve(undefined),
		});

		return {
			id: page.id,
			createdAt: page.createdAt.toISOString(),
			updatedAt: page.updatedAt.toISOString(),
			userId: page.userId,
			user: result.user,
			content: page.content,
			variables: page.variables,
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
