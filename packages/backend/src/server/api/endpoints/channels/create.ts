import { z } from 'zod';
import { generateSchema } from '@anatine/zod-openapi';
import { Inject, Injectable } from '@nestjs/common';
import ms from 'ms';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import type {
	ChannelsRepository,
	DriveFilesRepository,
} from '@/models/index.js';
import type { Channel } from '@/models/entities/Channel.js';
import { IdService } from '@/core/IdService.js';
import { ChannelEntityService } from '@/core/entities/ChannelEntityService.js';
import { DI } from '@/di-symbols.js';
import { ChannelSchema } from '@/models/zod/ChannelSchema.js';
import { misskeyIdPattern } from '@/models/zod/misc.js';
import { ApiError } from '../../error.js';

const res = ChannelSchema;
export const meta = {
	tags: ['channels'],
	requireCredential: true,
	prohibitMoved: true,
	kind: 'write:channels',
	limit: {
		duration: ms('1hour'),
		max: 10,
	},
	res: generateSchema(res),
	errors: {
		noSuchFile: {
			message: 'No such file.',
			code: 'NO_SUCH_FILE',
			id: 'cd1e9f3e-5a12-4ab4-96f6-5d0a2cc32050',
		},
	},
} as const;

const paramDef_ = z.object({
	name: z.string().min(1).max(128),
	description: z.string().min(1).max(2048).nullable().optional(),
	bannerId: misskeyIdPattern.optional(),
	color: z.string().min(1).max(16).optional(),
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
		@Inject(DI.driveFilesRepository)
		private driveFilesRepository: DriveFilesRepository,

		@Inject(DI.channelsRepository)
		private channelsRepository: ChannelsRepository,

		private idService: IdService,
		private channelEntityService: ChannelEntityService,
	) {
		super(meta, paramDef_, async (ps, me) => {
			let banner = null;
			if (ps.bannerId != null) {
				banner = await this.driveFilesRepository.findOneBy({
					id: ps.bannerId,
					userId: me.id,
				});

				if (banner == null) {
					throw new ApiError(meta.errors.noSuchFile);
				}
			}

			const channel = await this.channelsRepository
				.insert({
					id: this.idService.genId(),
					createdAt: new Date(),
					userId: me.id,
					name: ps.name,
					description: ps.description ?? null,
					bannerId: banner ? banner.id : null,
					...(ps.color !== undefined ? { color: ps.color } : {}),
				} as Channel)
				.then((x) => this.channelsRepository.findOneByOrFail(x.identifiers[0]));

			return (await this.channelEntityService.pack(
				channel,
				me,
			)) satisfies z.infer<typeof res>;
		});
	}
}
