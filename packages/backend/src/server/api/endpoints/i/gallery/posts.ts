import { z } from 'zod';
import { Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import { GalleryPostEntityService } from '@/core/entities/GalleryPostEntityService.js';
import { GalleryPostSchema } from '@/models/zod/GalleryPostSchema.js';
import { PaginationSchema, limit } from '@/models/zod/misc.js';
import { PrismaService } from '@/core/PrismaService.js';
import { PrismaQueryService } from '@/core/PrismaQueryService.js';

const res = z.array(GalleryPostSchema);
export const meta = {
	tags: ['account', 'gallery'],
	requireCredential: true,
	kind: 'read:gallery',
	res,
} as const;

export const paramDef = z
	.object({ limit: limit({ max: 100, default: 10 }) })
	.merge(PaginationSchema.pick({ sinceId: true, untilId: true }));

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
		private readonly prismaQueryService: PrismaQueryService,
	) {
		super(meta, paramDef, async (ps, me) => {
			const paginationQuery = this.prismaQueryService.getPaginationQuery({
				sinceId: ps.sinceId,
				untilId: ps.untilId,
			});

			const posts = await this.prismaService.client.gallery.findMany({
				where: { AND: [paginationQuery.where, { userId: me.id }] },
				orderBy: paginationQuery.orderBy,
				take: ps.limit,
			});

			return await Promise.all(
				posts.map((post) => this.galleryPostEntityService.pack(post, me)),
			);
		});
	}
}
