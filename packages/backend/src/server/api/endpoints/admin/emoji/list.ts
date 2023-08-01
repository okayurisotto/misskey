import { z } from 'zod';
import { Inject, Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import type { EmojisRepository } from '@/models/index.js';
import type { Emoji } from '@/models/entities/Emoji.js';
import { QueryService } from '@/core/QueryService.js';
import { DI } from '@/di-symbols.js';
import { EmojiEntityService } from '@/core/entities/EmojiEntityService.js';
import { MisskeyIdSchema } from '@/models/zod/misc.js';
//import { sqlLikeEscape } from '@/misc/sql-like-escape.js';

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

export const paramDef = z.object({
	query: z.string().nullable().default(null),
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
		@Inject(DI.emojisRepository)
		private emojisRepository: EmojisRepository,

		private emojiEntityService: EmojiEntityService,
		private queryService: QueryService,
	) {
		super(meta, paramDef, async (ps, me) => {
			const q = this.queryService
				.makePaginationQuery(
					this.emojisRepository.createQueryBuilder('emoji'),
					ps.sinceId,
					ps.untilId,
				)
				.andWhere('emoji.host IS NULL');

			let emojis: Emoji[];

			if (ps.query) {
				//q.andWhere('emoji.name ILIKE :q', { q: `%${ sqlLikeEscape(ps.query) }%` });
				//const emojis = await q.limit(ps.limit).getMany();

				emojis = await q.getMany();
				const queryarry = ps.query.match(/\:([a-z0-9_]*)\:/g);

				if (queryarry) {
					emojis = emojis.filter((emoji) =>
						queryarry.includes(`:${emoji.name}:`),
					);
				} else {
					emojis = emojis.filter(
						(emoji) =>
							emoji.name.includes(ps.query!) ||
							emoji.aliases.some((a) => a.includes(ps.query!)) ||
							emoji.category?.includes(ps.query!),
					);
				}
				emojis.splice(ps.limit + 1);
			} else {
				emojis = await q.limit(ps.limit).getMany();
			}

			return (await this.emojiEntityService.packDetailedMany(
				emojis,
			)) satisfies z.infer<typeof res>;
		});
	}
}
