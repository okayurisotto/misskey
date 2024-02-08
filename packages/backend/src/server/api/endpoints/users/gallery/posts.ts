import { z } from 'zod';
import { Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import { GalleryPostEntityService } from '@/core/entities/GalleryPostEntityService.js';
import { GalleryPostSchema } from '@/models/zod/GalleryPostSchema.js';
import { MisskeyIdSchema, PaginationSchema, limit } from '@/models/zod/misc.js';
import { PrismaQueryService } from '@/core/PrismaQueryService.js';
import { PrismaService } from '@/core/PrismaService.js';

const res = z.array(GalleryPostSchema);
export const meta = {
	tags: ['users', 'gallery'],
	description: 'Show all gallery posts by the given user.',
	res,
} as const;

export const paramDef = z
	.object({
		userId: MisskeyIdSchema,
		limit: limit({ max: 100, default: 10 }),
	})
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
				where: { AND: [paginationQuery.where, { userId: ps.userId }] },
				orderBy: paginationQuery.orderBy,
				take: ps.limit,
			});

			return await Promise.all(
				posts.map((post) => this.galleryPostEntityService.pack(post, me)),
			);
		});
	}
}
