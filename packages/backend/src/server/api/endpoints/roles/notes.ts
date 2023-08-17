import { z } from 'zod';
import { Inject, Injectable } from '@nestjs/common';
import * as Redis from 'ioredis';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import { DI } from '@/di-symbols.js';
import { NoteEntityService } from '@/core/entities/NoteEntityService.js';
import { IdService } from '@/core/IdService.js';
import { NoteSchema } from '@/models/zod/NoteSchema.js';
import { MisskeyIdSchema, limit } from '@/models/zod/misc.js';
import { ApiError } from '../../error.js';
import { PrismaService } from '@/core/PrismaService.js';
import { PrismaQueryService } from '@/core/PrismaQueryService.js';

const res = z.array(NoteSchema);
export const meta = {
	tags: ['role', 'notes'],
	requireCredential: true,
	errors: {
		noSuchRole: {
			message: 'No such role.',
			code: 'NO_SUCH_ROLE',
			id: 'eb70323a-df61-4dd4-ad90-89c83c7cf26e',
		},
	},
	res,
} as const;

export const paramDef = z.object({
	roleId: MisskeyIdSchema,
	limit: limit({ max: 100, default: 10 }),
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
		private readonly prismaService: PrismaService,
		private readonly prismaQueryService: PrismaQueryService,
	) {
		super(meta, paramDef, async (ps, me) => {
			const role = await this.prismaService.client.role.findUnique({
				where: {
					id: ps.roleId,
					isPublic: true,
				},
			});

			if (role == null) {
				throw new ApiError(meta.errors.noSuchRole);
			}
			if (!role.isExplorable) {
				return [];
			}
			const limit = ps.limit + (ps.untilId ? 1 : 0) + (ps.sinceId ? 1 : 0); // untilIdに指定したものも含まれるため+1
			const noteIdsRes = await this.redisClient.xrevrange(
				`roleTimeline:${role.id}`,
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

			const notes = (
				await this.prismaService.client.note.findMany({
					where: {
						AND: [
							{ id: { in: noteIds } },
							{ visibility: 'public' },
							this.prismaQueryService.getVisibilityWhereForNote(me.id),
							await this.prismaQueryService.getMutingWhereForNote(me.id),
							this.prismaQueryService.getBlockedWhereForNote(me.id),
						],
					},
				})
			).sort((a, b) => (a.id > b.id ? -1 : 1));

			return (await this.noteEntityService.packMany(
				notes,
				me,
			)) satisfies z.infer<typeof res>;
		});
	}
}
