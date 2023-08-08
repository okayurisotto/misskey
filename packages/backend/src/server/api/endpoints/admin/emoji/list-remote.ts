import { z } from 'zod';
import { Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import { UtilityService } from '@/core/UtilityService.js';
import { EmojiEntityService } from '@/core/entities/EmojiEntityService.js';
import { MisskeyIdSchema } from '@/models/zod/misc.js';
import { PrismaService } from '@/core/PrismaService.js';

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

export const paramDef = z.object({
	query: z.string().nullable().default(null),
	host: z
		.string()
		.nullable()
		.default(null)
		.describe('The local host is represented with `null`.'),
	limit: z.number().int().min(1).max(100).default(10),
	sinceId: MisskeyIdSchema.optional(),
	untilId: MisskeyIdSchema.optional(),
});

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
			const emojis = await this.prismaService.client.emoji.findMany({
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

			return (await Promise.all(
				emojis.map((emoji) => this.emojiEntityService.packDetailed(emoji)),
			)) satisfies z.infer<typeof res>;
		});
	}
}
