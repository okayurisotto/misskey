import { z } from 'zod';
import { Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import { IdService } from '@/core/IdService.js';
import { MisskeyIdSchema } from '@/models/zod/misc.js';
import { PrismaService } from '@/core/PrismaService.js';

export const meta = {
	tags: ['gallery'],
	requireCredential: true,
	prohibitMoved: true,
	kind: 'write:gallery-likes',
} as const;

export const paramDef = z.object({
	postId: MisskeyIdSchema,
});

@Injectable()
// eslint-disable-next-line import/no-default-export
export default class extends Endpoint<
	typeof meta,
	typeof paramDef,
	z.ZodType<void>
> {
	constructor(
		private readonly idService: IdService,
		private readonly prismaService: PrismaService,
	) {
		super(meta, paramDef, async (ps, me) => {
			await this.prismaService.client.galleryLike.create({
				data: {
					id: this.idService.genId(),
					createdAt: new Date(),
					user: { connect: { id: me.id } },
					gallery: {
						connect: {
							id: ps.postId,
							userId: { not: me.id },
						},
					},
				},
			});

			await this.prismaService.client.gallery_post.update({
				where: { id: ps.postId },
				data: { likedCount: { increment: 1 } },
			});
		});
	}
}
