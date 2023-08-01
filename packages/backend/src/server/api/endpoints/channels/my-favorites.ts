import { z } from 'zod';
import { Inject, Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import type { ChannelFavoritesRepository } from '@/models/index.js';
import { QueryService } from '@/core/QueryService.js';
import { ChannelEntityService } from '@/core/entities/ChannelEntityService.js';
import { DI } from '@/di-symbols.js';
import { ChannelSchema } from '@/models/zod/ChannelSchema.js';

const res = z.array(ChannelSchema);
export const meta = {
	tags: ['channels', 'account'],
	requireCredential: true,
	kind: 'read:channels',
	res,
} as const;

export const paramDef = z.unknown();

@Injectable()
// eslint-disable-next-line import/no-default-export
export default class extends Endpoint<
	typeof meta,
	typeof paramDef,
	typeof res
> {
	constructor(
		@Inject(DI.channelFavoritesRepository)
		private channelFavoritesRepository: ChannelFavoritesRepository,

		private channelEntityService: ChannelEntityService,
		private queryService: QueryService,
	) {
		super(meta, paramDef, async (ps, me) => {
			const query = this.channelFavoritesRepository
				.createQueryBuilder('favorite')
				.andWhere('favorite.userId = :meId', { meId: me.id })
				.leftJoinAndSelect('favorite.channel', 'channel');

			const favorites = await query.getMany();

			return (await Promise.all(
				favorites.map((x) => this.channelEntityService.pack(x.channel!, me)),
			)) satisfies z.infer<typeof res>;
		});
	}
}
