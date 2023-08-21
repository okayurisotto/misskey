import { z } from 'zod';
import { Injectable } from '@nestjs/common';
import { noSuchPost_, yourPost, alreadyLiked_ } from '@/server/api/errors.js';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import { IdService } from '@/core/IdService.js';
import { MisskeyIdSchema } from '@/models/zod/misc.js';
import { PrismaService } from '@/core/PrismaService.js';
import { ApiError } from '../../../error.js';

export const meta = {
	tags: ['gallery'],
	requireCredential: true,
	prohibitMoved: true,
	kind: 'write:gallery-likes',
	errors: {noSuchPost:noSuchPost_,yourPost:yourPost,alreadyLiked:alreadyLiked_},
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
			const post = await this.prismaService.client.gallery_post.findUnique({
				where: {
					id: ps.postId,
				},
			});
			if (post == null) {
				throw new ApiError(meta.errors.noSuchPost);
			}

			if (post.userId === me.id) {
				throw new ApiError(meta.errors.yourPost);
			}

			// if already liked
			const exist =
				(await this.prismaService.client.gallery_like.count({
					where: {
						postId: post.id,
						userId: me.id,
					},
					take: 1,
				})) > 0;

			if (exist) {
				throw new ApiError(meta.errors.alreadyLiked);
			}

			// Create like
			await this.prismaService.client.gallery_like.create({
				data: {
					id: this.idService.genId(),
					createdAt: new Date(),
					postId: post.id,
					userId: me.id,
				},
			});

			await this.prismaService.client.gallery_post.update({
				where: { id: post.id },
				data: { likedCount: { increment: 1 } },
			});
		});
	}
}
