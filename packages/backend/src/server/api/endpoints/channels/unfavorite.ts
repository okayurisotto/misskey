import { z } from 'zod';
import { Injectable } from '@nestjs/common';
import { noSuchChannel____ } from '@/server/api/errors.js';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import { MisskeyIdSchema } from '@/models/zod/misc.js';
import { PrismaService } from '@/core/PrismaService.js';
import { ApiError } from '../../error.js';

export const meta = {
	tags: ['channels'],
	requireCredential: true,
	prohibitMoved: true,
	kind: 'write:channels',
	errors: { noSuchChannel: noSuchChannel____ },
} as const;

export const paramDef = z.object({ channelId: MisskeyIdSchema });

@Injectable()
// eslint-disable-next-line import/no-default-export
export default class extends Endpoint<
	typeof meta,
	typeof paramDef,
	z.ZodType<void>
> {
	constructor(private readonly prismaService: PrismaService) {
		super(meta, paramDef, async (ps, me) => {
			const channel = await this.prismaService.client.channel.findUnique({
				where: { id: ps.channelId },
			});

			if (channel == null) {
				throw new ApiError(meta.errors.noSuchChannel);
			}

			await this.prismaService.client.channel_favorite.delete({
				where: {
					id: (
						await this.prismaService.client.channel_favorite.findFirstOrThrow({
							where: {
								userId: me.id,
								channelId: channel.id,
							},
						})
					).id,
				},
			});
		});
	}
}
