import { z } from 'zod';
import { Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import { PageEntityService } from '@/core/entities/PageEntityService.js';
import { PageSchema } from '@/models/zod/PageSchema.js';
import { PrismaService } from '@/core/PrismaService.js';

const res = z.array(PageSchema);
export const meta = {
	tags: ['pages'],
	requireCredential: false,
	res,
} as const;

export const paramDef = z.object({});

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
	) {
		super(meta, paramDef, async (ps, me) => {
			const pages = await this.prismaService.client.page.findMany({
				where: { visibility: 'public', likedCount: { gt: 0 } },
				orderBy: { likedCount: 'desc' },
				take: 10,
			});

			return (await Promise.all(
				pages.map((page) => this.pageEntityService.pack(page, me)),
			)) satisfies z.infer<typeof res>;
		});
	}
}
