import { z } from 'zod';
import { Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import { ChannelEntityService } from '@/core/entities/ChannelEntityService.js';
import { ChannelSchema } from '@/models/zod/ChannelSchema.js';
import { PrismaService } from '@/core/PrismaService.js';

const res = z.array(ChannelSchema);
export const meta = {
	tags: ['channels'],
	requireCredential: false,
	res,
} as const;

export const paramDef = z.object({});

@Injectable()
// eslint-disable-next-line import/no-default-export
export default class extends Endpoint<
	typeof meta,
	typeof paramDef,
	typeof res
> {
	constructor(
		private readonly channelEntityService: ChannelEntityService,
		private readonly prismaService: PrismaService,
	) {
		super(meta, paramDef, async (ps, me) => {
			const channels = await this.prismaService.client.channel.findMany({
				where: {
					lastNotedAt: { not: null },
					isArchived: false,
				},
				orderBy: { lastNotedAt: 'desc' },
				take: 10,
			});

			return await Promise.all(
				channels.map((x) => this.channelEntityService.pack(x, me)),
			);
		});
	}
}
