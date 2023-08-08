import { z } from 'zod';
import ms from 'ms';
import { Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import type { DriveFile } from '@/models/entities/DriveFile.js';
import { GalleryPostEntityService } from '@/core/entities/GalleryPostEntityService.js';
import { GalleryPostSchema } from '@/models/zod/GalleryPostSchema.js';
import { MisskeyIdSchema, uniqueItems } from '@/models/zod/misc.js';
import { PrismaService } from '@/core/PrismaService.js';

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
	res,
	errors: {},
} as const;

export const paramDef = z.object({
	postId: MisskeyIdSchema,
	title: z.string().min(1),
	description: z.string().nullable().optional(),
	fileIds: uniqueItems(z.array(MisskeyIdSchema).min(1).max(32)),
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
		private readonly galleryPostEntityService: GalleryPostEntityService,
		private readonly prismaService: PrismaService,
	) {
		super(meta, paramDef, async (ps, me) => {
			const files = (
				await Promise.all(
					ps.fileIds.map((fileId) =>
						this.prismaService.client.drive_file.findUnique({
							where: {
								id: fileId,
								userId: me.id,
							},
						}),
					),
				)
			).filter((file): file is DriveFile => file != null);

			if (files.length === 0) {
				throw new Error();
			}

			await this.prismaService.client.gallery_post.update({
				where: {
					id: ps.postId,
					userId: me.id,
				},
				data: {
					updatedAt: new Date(),
					title: ps.title,
					description: ps.description,
					isSensitive: ps.isSensitive,
					fileIds: files.map((file) => file.id),
				},
			});

			const post =
				await this.prismaService.client.gallery_post.findUniqueOrThrow({
					where: {
						id: ps.postId,
					},
				});

			return (await this.galleryPostEntityService.pack(
				post,
				me,
			)) satisfies z.infer<typeof res>;
		});
	}
}
