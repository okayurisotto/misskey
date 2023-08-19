import { noSuchPost___, notLiked_ } from '@/server/api/errors.js';
import { z } from 'zod';
import { Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import { MisskeyIdSchema } from '@/models/zod/misc.js';
import { PrismaService } from '@/core/PrismaService.js';
import { ApiError } from '../../../error.js';

export const meta = {
	tags: ['gallery'],
	requireCredential: true,
	prohibitMoved: true,
	kind: 'write:gallery-likes',
	errors: {noSuchPost:noSuchPost___,notLiked:notLiked_},
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
	constructor(private readonly prismaService: PrismaService) {
		super(meta, paramDef, async (ps, me) => {
			const post = await this.prismaService.client.gallery_post.findUnique({
				where: {
					id: ps.postId,
				},
			});
			if (post == null) {
				throw new ApiError(meta.errors.noSuchPost);
			}

			const exist = await this.prismaService.client.gallery_like.findUnique({
				where: {
					userId_postId: {
						postId: post.id,
						userId: me.id,
					},
				},
			});

			if (exist == null) {
				throw new ApiError(meta.errors.notLiked);
			}

			// Delete like
			await this.prismaService.client.gallery_like.delete({
				where: { id: exist.id },
			});

			await this.prismaService.client.gallery_post.update({
				where: { id: post.id },
				data: { likedCount: { decrement: 1 } },
			});
		});
	}
}
