import { z } from 'zod';
import { Injectable } from '@nestjs/common';
import ms from 'ms';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import { IdService } from '@/core/IdService.js';
import { ChannelEntityService } from '@/core/entities/ChannelEntityService.js';
import { ChannelSchema } from '@/models/zod/ChannelSchema.js';
import { MisskeyIdSchema } from '@/models/zod/misc.js';
import { PrismaService } from '@/core/PrismaService.js';
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
	res,
	errors: {
		noSuchFile: {
			message: 'No such file.',
			code: 'NO_SUCH_FILE',
			id: 'cd1e9f3e-5a12-4ab4-96f6-5d0a2cc32050',
		},
	},
} as const;

export const paramDef = z.object({
	name: z.string().min(1).max(128),
	description: z.string().min(1).max(2048).nullable().optional(),
	bannerId: MisskeyIdSchema.optional(),
	color: z.string().min(1).max(16).optional(),
});

@Injectable()
// eslint-disable-next-line import/no-default-export
export default class extends Endpoint<
	typeof meta,
	typeof paramDef,
	typeof res
> {
	constructor(
		private readonly idService: IdService,
		private readonly channelEntityService: ChannelEntityService,
		private readonly prismaService: PrismaService,
	) {
		super(meta, paramDef, async (ps, me) => {
			let banner = null;
			if (ps.bannerId != null) {
				banner = await this.prismaService.client.drive_file.findUnique({
					where: {
						id: ps.bannerId,
						userId: me.id,
					},
				});

				if (banner == null) {
					throw new ApiError(meta.errors.noSuchFile);
				}
			}

			const channel = await this.prismaService.client.channel.create({
				data: {
					id: this.idService.genId(),
					createdAt: new Date(),
					userId: me.id,
					name: ps.name,
					description: ps.description ?? null,
					bannerId: banner ? banner.id : null,
					...(ps.color !== undefined ? { color: ps.color } : {}),
				},
			});

			return (await this.channelEntityService.pack(
				channel,
				me,
			)) satisfies z.infer<typeof res>;
		});
	}
}
