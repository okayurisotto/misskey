import { z } from 'zod';
import { generateSchema } from '@anatine/zod-openapi';
import { Inject, Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import type {
	ChannelFollowingsRepository,
	ChannelsRepository,
} from '@/models/index.js';
import { GlobalEventService } from '@/core/GlobalEventService.js';
import { DI } from '@/di-symbols.js';
import { ApiError } from '../../error.js';
import { misskeyIdPattern } from '@/models/zod/misc.js';

export const meta = {
	tags: ['channels'],
	requireCredential: true,
	prohibitMoved: true,
	kind: 'write:channels',
	errors: {
		noSuchChannel: {
			message: 'No such channel.',
			code: 'NO_SUCH_CHANNEL',
			id: '19959ee9-0153-4c51-bbd9-a98c49dc59d6',
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

		@Inject(DI.channelFollowingsRepository)
		private channelFollowingsRepository: ChannelFollowingsRepository,
	) {
		super(meta, paramDef_, async (ps, me) => {
			const channel = await this.channelsRepository.findOneBy({
				id: ps.channelId,
			});

			if (channel == null) {
				throw new ApiError(meta.errors.noSuchChannel);
			}

			await this.channelFollowingsRepository.delete({
				followerId: me.id,
				followeeId: channel.id,
			});
		});
	}
}
