import { z } from 'zod';
import { Inject, Injectable } from '@nestjs/common';
import * as Redis from 'ioredis';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import { NoteReadService } from '@/core/NoteReadService.js';
import { DI } from '@/di-symbols.js';
import { NoteEntityService } from '@/core/entities/NoteEntityService.js';
import { IdService } from '@/core/IdService.js';
import { NoteSchema } from '@/models/zod/NoteSchema.js';
import { MisskeyIdSchema } from '@/models/zod/misc.js';
import { PrismaService } from '@/core/PrismaService.js';
import { PrismaQueryService } from '@/core/PrismaQueryService.js';
import { ApiError } from '../../error.js';

const res = z.array(NoteSchema);
export const meta = {
	tags: ['antennas', 'account', 'notes'],
	requireCredential: true,
	kind: 'read:account',
	errors: {
		noSuchAntenna: {
			message: 'No such antenna.',
			code: 'NO_SUCH_ANTENNA',
			id: '850926e0-fd3b-49b6-b69a-b28a5dbd82fe',
		},
	},
	res,
} as const;

export const paramDef = z.object({
	antennaId: MisskeyIdSchema,
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
		private readonly noteReadService: NoteReadService,
		private readonly prismaService: PrismaService,
		private readonly prismaQueryService: PrismaQueryService,
	) {
		super(meta, paramDef, async (ps, me) => {
			const antenna = await this.prismaService.client.antenna.findUnique({
				where: {
					id: ps.antennaId,
					userId: me.id,
				},
			});

			if (antenna == null) {
				throw new ApiError(meta.errors.noSuchAntenna);
			}

			this.prismaService.client.antenna.update({
				where: { id: antenna.id },
				data: {
					isActive: true,
					lastUsedAt: new Date(),
				},
			});

			const limit = ps.limit + (ps.untilId ? 1 : 0) + (ps.sinceId ? 1 : 0); // untilIdに指定したものも含まれるため+1
			const noteIdsRes = await this.redisClient.xrevrange(
				`antennaTimeline:${antenna.id}`,
				ps.untilId
					? this.idService.parse(ps.untilId).date.getTime()
					: ps.untilDate ?? '+',
				ps.sinceId
					? this.idService.parse(ps.sinceId).date.getTime()
					: ps.sinceDate ?? '-',
				'COUNT',
				limit,
			);

			if (noteIdsRes.length === 0) {
				return [];
			}

			const noteIds = noteIdsRes
				.map((x) => x[1][1])
				.filter((x) => x !== ps.untilId && x !== ps.sinceId);

			if (noteIds.length === 0) {
				return [];
			}

			const paginationQuery = this.prismaQueryService.getPaginationQuery({
				sinceDate: ps.sinceDate,
				sinceId: ps.sinceId,
				untilDate: ps.untilDate,
				untilId: ps.untilId,
			});

			const notes = await this.prismaService.client.note.findMany({
				where: {
					AND: [
						{ id: { in: noteIds } },
						paginationQuery.where,
						this.prismaQueryService.getVisibilityWhereForNote(me.id),
						await this.prismaQueryService.getMutingWhereForNote(me.id),
						this.prismaQueryService.getBlockedWhereForNote(me.id),
					],
				},
				orderBy: paginationQuery.orderBy,
			});

			if (notes.length > 0) {
				this.noteReadService.read(me.id, notes);
			}

			return (await this.noteEntityService.packMany(
				notes,
				me,
			)) satisfies z.infer<typeof res>;
		});
	}
}
