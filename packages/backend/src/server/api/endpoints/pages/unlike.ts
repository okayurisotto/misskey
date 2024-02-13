import { z } from 'zod';
import { Injectable } from '@nestjs/common';
import { noSuchPage_____, notLiked__ } from '@/server/api/errors.js';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import { MisskeyIdSchema } from '@/models/zod/misc.js';
import { PrismaService } from '@/core/PrismaService.js';
import { ApiError } from '../../error.js';

export const meta = {
	tags: ['pages'],
	requireCredential: true,
	prohibitMoved: true,
	kind: 'write:page-likes',
	errors: { noSuchPage: noSuchPage_____, notLiked: notLiked__ },
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

			const exist = await this.prismaService.client.pageLike.findUnique({
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
			await this.prismaService.client.pageLike.delete({
				where: { id: exist.id },
			});
		});
	}
}
