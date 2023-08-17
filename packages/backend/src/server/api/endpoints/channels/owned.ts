import { z } from 'zod';
import { Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import { ChannelEntityService } from '@/core/entities/ChannelEntityService.js';
import { ChannelSchema } from '@/models/zod/ChannelSchema.js';
import { MisskeyIdSchema, limit } from '@/models/zod/misc.js';
import { PrismaService } from '@/core/PrismaService.js';
import { PrismaQueryService } from '@/core/PrismaQueryService.js';

const res = z.array(ChannelSchema);
export const meta = {
	tags: ['channels', 'account'],
	requireCredential: true,
	kind: 'read:channels',
	res,
} as const;

export const paramDef = z.object({
	sinceId: MisskeyIdSchema.optional(),
	untilId: MisskeyIdSchema.optional(),
	limit: limit({ max: 100, default: 5 }),
});

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
		private readonly prismaQueryService: PrismaQueryService,
	) {
		super(meta, paramDef, async (ps, me) => {
			const paginationQuery = this.prismaQueryService.getPaginationQuery({
				sinceId: ps.sinceId,
				untilId: ps.untilId,
			});

			const channels = await this.prismaService.client.channel.findMany({
				where: {
					AND: [
						paginationQuery.where,
						{ isArchived: false },
						{ userId: me.id },
					],
				},
				orderBy: paginationQuery.orderBy,
				take: ps.limit,
			});

			return (await Promise.all(
				channels.map((x) => this.channelEntityService.pack(x, me)),
			)) satisfies z.infer<typeof res>;
		});
	}
}
