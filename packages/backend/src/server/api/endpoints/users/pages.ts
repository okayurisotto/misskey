import { z } from 'zod';
import { Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import { PageEntityService } from '@/core/entities/PageEntityService.js';
import { PageSchema } from '@/models/zod/PageSchema.js';
import { MisskeyIdSchema, PaginationSchema, limit } from '@/models/zod/misc.js';
import { PrismaService } from '@/core/PrismaService.js';
import { PrismaQueryService } from '@/core/PrismaQueryService.js';

const res = z.array(PageSchema);
export const meta = {
	tags: ['users', 'pages'],
	description: 'Show all pages this user created.',
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
		private readonly pageEntityService: PageEntityService,
		private readonly prismaService: PrismaService,
		private readonly prismaQueryService: PrismaQueryService,
	) {
		super(meta, paramDef, async (ps, me) => {
			const paginationQuery = this.prismaQueryService.getPaginationQuery({
				sinceId: ps.sinceId,
				untilId: ps.untilId,
			});

			const pages = await this.prismaService.client.page.findMany({
				where: {
					AND: [
						paginationQuery.where,
						{ userId: ps.userId },
						{ visibility: 'public' },
					],
				},
				orderBy: paginationQuery.orderBy,
				take: ps.limit,
			});

			return (await Promise.all(
				pages.map((page) => this.pageEntityService.pack(page)),
			)) satisfies z.infer<typeof res>;
		});
	}
}
