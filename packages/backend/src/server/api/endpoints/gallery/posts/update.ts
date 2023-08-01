import { z } from 'zod';
import { generateSchema } from '@anatine/zod-openapi';
import ms from 'ms';
import { Inject, Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import type {
	DriveFilesRepository,
	GalleryPostsRepository,
} from '@/models/index.js';
import type { DriveFile } from '@/models/entities/DriveFile.js';
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
		max: 300,
	},
	res: generateSchema(res),
	errors: {},
} as const;

const paramDef_ = z.object({
	postId: misskeyIdPattern,
	title: z.string().min(1),
	description: z.string().nullable().optional(),
	fileIds: uniqueItems(z.array(misskeyIdPattern).min(1).max(32)),
	isSensitive: z.boolean().default(false),
});
export const paramDef = generateSchema(paramDef_);

@Injectable()
// eslint-disable-next-line import/no-default-export
export default class extends Endpoint<
	typeof meta,
	typeof paramDef_,
	typeof res
> {
	constructor(
		@Inject(DI.galleryPostsRepository)
		private galleryPostsRepository: GalleryPostsRepository,

		@Inject(DI.driveFilesRepository)
		private driveFilesRepository: DriveFilesRepository,

		private galleryPostEntityService: GalleryPostEntityService,
	) {
		super(meta, paramDef_, async (ps, me) => {
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

			await this.galleryPostsRepository.update(
				{
					id: ps.postId,
					userId: me.id,
				},
				{
					updatedAt: new Date(),
					title: ps.title,
					description: ps.description,
					isSensitive: ps.isSensitive,
					fileIds: files.map((file) => file.id),
				},
			);

			const post = await this.galleryPostsRepository.findOneByOrFail({
				id: ps.postId,
			});

			return (await this.galleryPostEntityService.pack(
				post,
				me,
			)) satisfies z.infer<typeof res>;
		});
	}
}
