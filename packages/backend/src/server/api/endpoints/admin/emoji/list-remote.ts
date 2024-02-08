import { z } from 'zod';
import { Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import { UtilityService } from '@/core/UtilityService.js';
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
			.describe('The local host is represented with `null`.'),
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
		host: z
			.string()
			.nullable()
			.default(null)
			.describe('The local host is represented with `null`.'),
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
		private readonly utilityService: UtilityService,
		private readonly emojiEntityService: EmojiEntityService,
		private readonly prismaService: PrismaService,
	) {
		super(meta, paramDef, async (ps) => {
			const emojis = await this.prismaService.client.customEmoji.findMany({
				where: {
					AND: [
						{ id: { gt: ps.sinceId } },
						{ id: { lt: ps.untilId } },
						ps.host == null
							? { host: { not: null } }
							: { host: this.utilityService.toPuny(ps.host) },
						ps.query ? { name: { contains: ps.query } } : {},
					],
				},
				orderBy: { id: 'desc' },
				take: ps.limit,
			});

			const data = { emoji: new EntityMap('id', emojis) };

			return emojis.map((emoji) =>
				this.emojiEntityService.packDetailed(emoji.id, data),
			);
		});
	}
}
