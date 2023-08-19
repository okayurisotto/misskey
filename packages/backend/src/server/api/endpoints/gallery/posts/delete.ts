import { noSuchPost } from '@/server/api/errors.js';
import { z } from 'zod';
import { Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import { MisskeyIdSchema } from '@/models/zod/misc.js';
import { PrismaService } from '@/core/PrismaService.js';
import { ApiError } from '../../../error.js';

export const meta = {
	tags: ['gallery'],
	requireCredential: true,
	kind: 'write:gallery',
	errors: {noSuchPost:noSuchPost},
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
					userId: me.id,
				},
			});

			if (post == null) {
				throw new ApiError(meta.errors.noSuchPost);
			}

			await this.prismaService.client.gallery_post.delete({
				where: { id: post.id },
			});
		});
	}
}
