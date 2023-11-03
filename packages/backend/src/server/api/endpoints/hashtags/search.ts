import { z } from 'zod';
import { Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import { PrismaService } from '@/core/PrismaService.js';
import { limit } from '@/models/zod/misc.js';

const res = z.array(z.string());
export const meta = {
	tags: ['hashtags'],
	requireCredential: false,
	res,
} as const;

export const paramDef = z.object({
	limit: limit({ max: 100, default: 10 }),
	query: z.string(),
	offset: z.number().int().default(0),
});

@Injectable()
// eslint-disable-next-line import/no-default-export
export default class extends Endpoint<
	typeof meta,
	typeof paramDef,
	typeof res
> {
	constructor(private readonly prismaService: PrismaService) {
		super(meta, paramDef, async (ps) => {
			const hashtags = await this.prismaService.client.hashtag.findMany({
				where: { name: { startsWith: ps.query.toLowerCase() } },
				orderBy: { mentionedUsersCount: 'desc' },
				take: ps.limit,
				skip: ps.offset,
			});

			return hashtags.map((tag) => tag.name);
		});
	}
}
