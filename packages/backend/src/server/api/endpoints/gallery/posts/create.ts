import { z } from 'zod';
import ms from 'ms';
import { Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import { IdService } from '@/core/IdService.js';
import { GalleryPostEntityService } from '@/core/entities/GalleryPostEntityService.js';
import { GalleryPostSchema } from '@/models/zod/GalleryPostSchema.js';
import { MisskeyIdSchema, uniqueItems } from '@/models/zod/misc.js';
import { PrismaService } from '@/core/PrismaService.js';
import type { drive_file } from '@prisma/client';

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
		private readonly idService: IdService,
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
			).filter((file): file is drive_file => file != null);

			if (files.length === 0) {
				throw new Error();
			}

			const post = await this.prismaService.client.gallery_post.create({
				data: {
					id: this.idService.genId(),
					createdAt: new Date(),
					updatedAt: new Date(),
					title: ps.title,
					description: ps.description,
					userId: me.id,
					isSensitive: ps.isSensitive,
					fileIds: files.map((file) => file.id),
				},
			});

			return (await this.galleryPostEntityService.pack(
				post,
				me,
			)) satisfies z.infer<typeof res>;
		});
	}
}
