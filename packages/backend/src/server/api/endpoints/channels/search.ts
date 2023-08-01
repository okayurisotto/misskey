import { z } from 'zod';
import { generateSchema } from '@anatine/zod-openapi';
import { Inject, Injectable } from '@nestjs/common';
import { Brackets } from 'typeorm';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import { QueryService } from '@/core/QueryService.js';
import type { ChannelsRepository } from '@/models/index.js';
import { ChannelEntityService } from '@/core/entities/ChannelEntityService.js';
import { DI } from '@/di-symbols.js';
import { sqlLikeEscape } from '@/misc/sql-like-escape.js';
import { ChannelSchema } from '@/models/zod/ChannelSchema.js';
import { misskeyIdPattern } from '@/models/zod/misc.js';

const res = z.array(ChannelSchema);
export const meta = {
	tags: ['channels'],
	requireCredential: false,
	res: generateSchema(res),
} as const;

const paramDef_ = z.object({
	query: z.string(),
	type: z
		.enum(['nameAndDescription', 'nameOnly'])
		.default('nameAndDescription'),
	sinceId: misskeyIdPattern.optional(),
	untilId: misskeyIdPattern.optional(),
	limit: z.number().int().min(1).max(100).default(5),
});
export const paramDef = generateSchema(paramDef_);

@Injectable()
// eslint-disable-next-line import/no-default-export
export default class extends Endpoint<
	typeof meta,
	typeof paramDef_,
	typeof res
> {
	constructor(
		@Inject(DI.channelsRepository)
		private channelsRepository: ChannelsRepository,

		private channelEntityService: ChannelEntityService,
		private queryService: QueryService,
	) {
		super(meta, paramDef_, async (ps, me) => {
			const query = this.queryService
				.makePaginationQuery(
					this.channelsRepository.createQueryBuilder('channel'),
					ps.sinceId,
					ps.untilId,
				)
				.andWhere('channel.isArchived = FALSE');

			if (ps.query !== '') {
				if (ps.type === 'nameAndDescription') {
					query.andWhere(
						new Brackets((qb) => {
							qb.where('channel.name ILIKE :q', {
								q: `%${sqlLikeEscape(ps.query)}%`,
							}).orWhere('channel.description ILIKE :q', {
								q: `%${sqlLikeEscape(ps.query)}%`,
							});
						}),
					);
				} else {
					query.andWhere('channel.name ILIKE :q', {
						q: `%${sqlLikeEscape(ps.query)}%`,
					});
				}
			}

			const channels = await query.limit(ps.limit).getMany();

			return (await Promise.all(
				channels.map((x) => this.channelEntityService.pack(x, me)),
			)) satisfies z.infer<typeof res>;
		});
	}
}
