import { z } from 'zod';
import { Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import { MisskeyIdSchema } from '@/models/zod/misc.js';
import { ApiError } from '../../error.js';
import { PrismaService } from '@/core/PrismaService.js';

export const meta = {
	tags: ['pages'],
	requireCredential: true,
	prohibitMoved: true,
	kind: 'write:page-likes',
	errors: {
		noSuchPage: {
			message: 'No such page.',
			code: 'NO_SUCH_PAGE',
			id: 'a0d41e20-1993-40bd-890e-f6e560ae648e',
		},
		notLiked: {
			message: 'You have not liked that page.',
			code: 'NOT_LIKED',
			id: 'f5e586b0-ce93-4050-b0e3-7f31af5259ee',
		},
	},
} as const;

export const paramDef = z.object({
	pageId: MisskeyIdSchema,
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
			const page = await this.prismaService.client.page.findUnique({
				where: { id: ps.pageId },
			});
			if (page == null) {
				throw new ApiError(meta.errors.noSuchPage);
			}

			const exist = await this.prismaService.client.page_like.findUnique({
				where: {
					userId_pageId: {
						pageId: page.id,
						userId: me.id,
					},
				},
			});

			if (exist == null) {
				throw new ApiError(meta.errors.notLiked);
			}

			// Delete like
			await this.prismaService.client.page_like.delete({
				where: { id: exist.id },
			});

			this.prismaService.client.page.update({
				where: { id: page.id },
				data: { likedCount: { decrement: 1 } },
			});
		});
	}
}
