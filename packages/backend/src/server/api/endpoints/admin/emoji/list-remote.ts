import { z } from 'zod';
import { Inject, Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import type { EmojisRepository } from '@/models/index.js';
import { QueryService } from '@/core/QueryService.js';
import { UtilityService } from '@/core/UtilityService.js';
import { EmojiEntityService } from '@/core/entities/EmojiEntityService.js';
import { DI } from '@/di-symbols.js';
import { sqlLikeEscape } from '@/misc/sql-like-escape.js';
import { MisskeyIdSchema } from '@/models/zod/misc.js';

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

// eslint-disable-next-line import/no-default-export
@Injectable()
export default class extends Endpoint<
	typeof meta,
	typeof paramDef,
	typeof res
> {
	constructor(
		@Inject(DI.emojisRepository)
		private emojisRepository: EmojisRepository,

		private utilityService: UtilityService,
		private queryService: QueryService,
		private emojiEntityService: EmojiEntityService,
	) {
		super(meta, paramDef, async (ps, me) => {
			const q = this.queryService.makePaginationQuery(
				this.emojisRepository.createQueryBuilder('emoji'),
				ps.sinceId,
				ps.untilId,
			);

			if (ps.host == null) {
				q.andWhere('emoji.host IS NOT NULL');
			} else {
				q.andWhere('emoji.host = :host', {
					host: this.utilityService.toPuny(ps.host),
				});
			}

			if (ps.query) {
				q.andWhere('emoji.name like :query', {
					query: '%' + sqlLikeEscape(ps.query) + '%',
				});
			}

			const emojis = await q
				.orderBy('emoji.id', 'DESC')
				.limit(ps.limit ?? 10)
				.getMany();

			return (await Promise.all(
				emojis.map((emoji) => this.emojiEntityService.packDetailed(emoji)),
			)) satisfies z.infer<typeof res>;
		});
	}
}
