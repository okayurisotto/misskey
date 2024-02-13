import { z } from 'zod';
import { Injectable } from '@nestjs/common';
import {
	noSuchPage___,
	yourPage,
	alreadyLiked__,
} from '@/server/api/errors.js';
import { IdService } from '@/core/IdService.js';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import { MisskeyIdSchema } from '@/models/zod/misc.js';
import { PrismaService } from '@/core/PrismaService.js';
import { ApiError } from '../../error.js';

export const meta = {
	tags: ['pages'],
	requireCredential: true,
	prohibitMoved: true,
	kind: 'write:page-likes',
	errors: {
		noSuchPage: noSuchPage___,
		yourPage: yourPage,
		alreadyLiked: alreadyLiked__,
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
	constructor(
		private readonly idService: IdService,
		private readonly prismaService: PrismaService,
	) {
		super(meta, paramDef, async (ps, me) => {
			const page = await this.prismaService.client.page.findUnique({
				where: { id: ps.pageId },
			});
			if (page == null) {
				throw new ApiError(meta.errors.noSuchPage);
			}

			if (page.userId === me.id) {
				throw new ApiError(meta.errors.yourPage);
			}

			// if already liked
			const exist =
				(await this.prismaService.client.page_like.count({
					where: {
						pageId: page.id,
						userId: me.id,
					},
					take: 1,
				})) > 0;

			if (exist) {
				throw new ApiError(meta.errors.alreadyLiked);
			}

			// Create like
			await this.prismaService.client.page_like.create({
				data: {
					id: this.idService.genId(),
					createdAt: new Date(),
					pageId: page.id,
					userId: me.id,
				},
			});
		});
	}
}
