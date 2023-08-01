import { z } from 'zod';
import { generateSchema } from '@anatine/zod-openapi';
import { Inject, Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import type {
	ChannelFavoritesRepository,
	ChannelsRepository,
} from '@/models/index.js';
import { IdService } from '@/core/IdService.js';
import { DI } from '@/di-symbols.js';
import { misskeyIdPattern } from '@/models/zod/misc.js';
import { ApiError } from '../../error.js';

export const meta = {
	tags: ['channels'],
	requireCredential: true,
	prohibitMoved: true,
	kind: 'write:channels',
	errors: {
		noSuchChannel: {
			message: 'No such channel.',
			code: 'NO_SUCH_CHANNEL',
			id: '4938f5f3-6167-4c04-9149-6607b7542861',
		},
	},
} as const;

const paramDef_ = z.object({
	channelId: misskeyIdPattern,
});
export const paramDef = generateSchema(paramDef_);

@Injectable()
// eslint-disable-next-line import/no-default-export
export default class extends Endpoint<
	typeof meta,
	typeof paramDef_,
	z.ZodType<void>
> {
	constructor(
		@Inject(DI.channelsRepository)
		private channelsRepository: ChannelsRepository,

		@Inject(DI.channelFavoritesRepository)
		private channelFavoritesRepository: ChannelFavoritesRepository,

		private idService: IdService,
	) {
		super(meta, paramDef_, async (ps, me) => {
			const channel = await this.channelsRepository.findOneBy({
				id: ps.channelId,
			});

			if (channel == null) {
				throw new ApiError(meta.errors.noSuchChannel);
			}

			await this.channelFavoritesRepository.insert({
				id: this.idService.genId(),
				createdAt: new Date(),
				userId: me.id,
				channelId: channel.id,
			});
		});
	}
}
