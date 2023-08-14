import { z } from 'zod';
import { Inject, Injectable } from '@nestjs/common';
import * as Redis from 'ioredis';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import { NoteEntityService } from '@/core/entities/NoteEntityService.js';
import ActiveUsersChart from '@/core/chart/charts/active-users.js';
import { DI } from '@/di-symbols.js';
import { IdService } from '@/core/IdService.js';
import { NoteSchema } from '@/models/zod/NoteSchema.js';
import { MisskeyIdSchema } from '@/models/zod/misc.js';
import { PrismaService } from '@/core/PrismaService.js';
import { PrismaQueryService } from '@/core/PrismaQueryService.js';
import { ApiError } from '../../error.js';
import type { note } from '@prisma/client';

const res = z.array(NoteSchema);
export const meta = {
	tags: ['notes', 'channels'],
	requireCredential: false,
	res,
	errors: {
		noSuchChannel: {
			message: 'No such channel.',
			code: 'NO_SUCH_CHANNEL',
			id: '4d0eeeba-a02c-4c3c-9966-ef60d38d2e7f',
		},
	},
} as const;

export const paramDef = z.object({
	channelId: MisskeyIdSchema,
	limit: z.number().int().min(1).max(100).default(10),
	sinceId: MisskeyIdSchema.optional(),
	untilId: MisskeyIdSchema.optional(),
	sinceDate: z.number().int().optional(),
	untilDate: z.number().int().optional(),
});

@Injectable()
// eslint-disable-next-line import/no-default-export
export default class extends Endpoint<
	typeof meta,
	typeof paramDef,
	typeof res
> {
	constructor(
		@Inject(DI.redis)
		private redisClient: Redis.Redis,

		private readonly idService: IdService,
		private readonly noteEntityService: NoteEntityService,
		private readonly activeUsersChart: ActiveUsersChart,
		private readonly prismaService: PrismaService,
		private readonly prismaQueryService: PrismaQueryService,
	) {
		super(meta, paramDef, async (ps, me) => {
			const channel = await this.prismaService.client.channel.findUnique({
				where: { id: ps.channelId },
			});

			if (channel == null) {
				throw new ApiError(meta.errors.noSuchChannel);
			}

			let timeline: note[] = [];

			const limit = ps.limit + (ps.untilId ? 1 : 0); // untilIdに指定したものも含まれるため+1
			let noteIdsRes: [string, string[]][] = [];

			if (!ps.sinceId && !ps.sinceDate) {
				noteIdsRes = await this.redisClient.xrevrange(
					`channelTimeline:${channel.id}`,
					ps.untilId
						? this.idService.parse(ps.untilId).date.getTime()
						: ps.untilDate ?? '+',
					'-',
					'COUNT',
					limit,
				);
			}

			// redis から取得していないとき・取得数が足りないとき
			if (noteIdsRes.length < limit) {
				const paginationQuery = this.prismaQueryService.getPaginationQuery({
					sinceId: ps.sinceId,
					untilId: ps.untilId,
					sinceDate: ps.sinceDate,
					untilDate: ps.untilDate,
				});

				timeline = await this.prismaService.client.note.findMany({
					where: {
						AND: [
							paginationQuery.where,
							{ channelId: channel.id },
							await this.prismaQueryService.getMutingWhereForNote(me?.id ?? null),
							await this.prismaQueryService.getNoteThreadMutingWhereForNote(
								me?.id ?? null,
							),
							this.prismaQueryService.getBlockedWhereForNote(me?.id ?? null),
						],
					},
					orderBy: paginationQuery.orderBy,
					take: ps.limit,
				});
			} else {
				const noteIds = noteIdsRes
					.map((x) => x[1][1])
					.filter((x) => x !== ps.untilId);

				if (noteIds.length === 0) {
					return [];
				}

				timeline = await this.prismaService.client.note.findMany({
					where: {
						AND: [
							{ id: { in: noteIds } },
							await this.prismaQueryService.getMutingWhereForNote(me?.id ?? null),
							await this.prismaQueryService.getNoteThreadMutingWhereForNote(
								me?.id ?? null,
							),
							this.prismaQueryService.getBlockedWhereForNote(me?.id ?? null),
						],
					},
					orderBy: { id: 'desc' },
				});
			}

			if (me) this.activeUsersChart.read(me);

			return (await this.noteEntityService.packMany(
				timeline,
				me,
			)) satisfies z.infer<typeof res>;
		});
	}
}
