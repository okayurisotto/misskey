import { z } from 'zod';
import { Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import { GalleryPostEntityService } from '@/core/entities/GalleryPostEntityService.js';
import { GalleryPostSchema } from '@/models/zod/GalleryPostSchema.js';
import { PrismaService } from '@/core/PrismaService.js';

const res = z.array(GalleryPostSchema);
export const meta = {
	tags: ['gallery'],
	requireCredential: false,
	res,
} as const;

export const paramDef = z.object({});

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
			const posts = await this.prismaService.client.gallery_post.findMany({
				where: { likedCount: { gt: 0 } },
				orderBy: { likedCount: 'desc' },
				take: 10,
			});

			return (await Promise.all(
				posts.map((post) => this.galleryPostEntityService.pack(post, me)),
			)) satisfies z.infer<typeof res>;
		});
	}
}
