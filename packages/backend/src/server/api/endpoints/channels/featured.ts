import { z } from 'zod';
import { Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import { ChannelEntityService } from '@/core/entities/ChannelEntityService.js';
import { ChannelSchema } from '@/models/zod/ChannelSchema.js';
import { PrismaService } from '@/core/PrismaService.js';
import { isNotNull } from '@/misc/is-not-null.js';

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
			const notes = await this.prismaService.client.note.findMany({
				where: { channel: { isArchived: false } },
				include: { channel: true },
				orderBy: { createdAt: 'desc' },
				take: 10,
				distinct: ['channelId'],
			});

			return await Promise.all(
				notes
					.map((note) => note.channel)
					.filter(isNotNull)
					.map((channel) => this.channelEntityService.pack(channel, me)),
			);
		});
	}
}
