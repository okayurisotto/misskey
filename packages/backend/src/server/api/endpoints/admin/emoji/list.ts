import { z } from 'zod';
import { Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import { EmojiEntityService } from '@/core/entities/EmojiEntityService.js';
import { MisskeyIdSchema, PaginationSchema, limit } from '@/models/zod/misc.js';
import { PrismaService } from '@/core/PrismaService.js';
import { EntityMap } from '@/misc/EntityMap.js';

const res = z.array(
	z.object({
		id: MisskeyIdSchema,
		aliases: z.array(z.string()),
		name: z.string(),
		category: z.string().nullable(),
		host: z
			.string()
			.nullable()
			.describe(
				'The local host is represented with `null`. The field exists for compatibility with other API endpoints that return files.',
			),
		url: z.string(),
	}),
);
export const meta = {
	tags: ['admin'],
	requireCredential: true,
	requireRolePolicy: 'canManageCustomEmojis',
	res,
} as const;

export const paramDef = z
	.object({
		query: z.string().nullable().default(null),
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
		private readonly emojiEntityService: EmojiEntityService,
		private readonly prismaService: PrismaService,
	) {
		super(meta, paramDef, async (ps) => {
			const emojis = await this.prismaService.client.customEmoji.findMany({
				where: {
					AND: [
						ps.sinceId ? { id: { gt: ps.sinceId } } : {},
						ps.untilId ? { id: { lt: ps.untilId } } : {},
						{ host: null },
						ps.query
							? /^:[a-z0-9_]+:$/g.test(ps.query)
								? { name: ps.query.substring(1, ps.query.length - 1) }
								: {
										OR: [
											{ name: { contains: ps.query } },
											{ aliases: { has: ps.query } }, // TOOD: 配列の各要素でcontainsしたいが、Prismaにそのような機能はなさそう
											{ category: { contains: ps.query } },
										],
								  }
							: {},
					],
				},
				take: ps.limit,
			});

			const data = { emoji: new EntityMap('id', emojis) };

			return emojis.map((emoji) =>
				this.emojiEntityService.packDetailed(emoji.id, data),
			);
		});
	}
}
