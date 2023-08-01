import { z } from 'zod';
import ms from 'ms';
import { Inject, Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import type {
	DriveFilesRepository,
	GalleryPostsRepository,
} from '@/models/index.js';
import { GalleryPost } from '@/models/entities/GalleryPost.js';
import type { DriveFile } from '@/models/entities/DriveFile.js';
import { IdService } from '@/core/IdService.js';
import { GalleryPostEntityService } from '@/core/entities/GalleryPostEntityService.js';
import { DI } from '@/di-symbols.js';
import { GalleryPostSchema } from '@/models/zod/GalleryPostSchema.js';
import { misskeyIdPattern, uniqueItems } from '@/models/zod/misc.js';

const res = GalleryPostSchema;
export const meta = {
	tags: ['gallery'],
	requireCredential: true,
	prohibitMoved: true,
	kind: 'write:gallery',
	limit: {
		duration: ms('1hour'),
		max: 20,
	},
	res,
	errors: {},
} as const;

export const paramDef = z.object({
	title: z.string().min(1),
	description: z.string().nullable().optional(),
	fileIds: uniqueItems(z.array(misskeyIdPattern).min(1).max(32)),
	isSensitive: z.boolean().default(false),
});

@Injectable()
// eslint-disable-next-line import/no-default-export
export default class extends Endpoint<
	typeof meta,
	typeof paramDef,
	typeof res
> {
	constructor(
		@Inject(DI.galleryPostsRepository)
		private galleryPostsRepository: GalleryPostsRepository,

		@Inject(DI.driveFilesRepository)
		private driveFilesRepository: DriveFilesRepository,

		private galleryPostEntityService: GalleryPostEntityService,
		private idService: IdService,
	) {
		super(meta, paramDef, async (ps, me) => {
			const files = (
				await Promise.all(
					ps.fileIds.map((fileId) =>
						this.driveFilesRepository.findOneBy({
							id: fileId,
							userId: me.id,
						}),
					),
				)
			).filter((file): file is DriveFile => file != null);

			if (files.length === 0) {
				throw new Error();
			}

			const post = await this.galleryPostsRepository
				.insert(
					new GalleryPost({
						id: this.idService.genId(),
						createdAt: new Date(),
						updatedAt: new Date(),
						title: ps.title,
						description: ps.description,
						userId: me.id,
						isSensitive: ps.isSensitive,
						fileIds: files.map((file) => file.id),
					}),
				)
				.then((x) =>
					this.galleryPostsRepository.findOneByOrFail(x.identifiers[0]),
				);

			return (await this.galleryPostEntityService.pack(
				post,
				me,
			)) satisfies z.infer<typeof res>;
		});
	}
}
