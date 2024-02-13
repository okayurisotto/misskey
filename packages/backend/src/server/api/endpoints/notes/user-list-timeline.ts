import { z } from 'zod';
import { Injectable } from '@nestjs/common';
import { noSuchList } from '@/server/api/errors.js';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import { NoteEntityPackService } from '@/core/entities/NoteEntityPackService.js';
import ActiveUsersChart from '@/core/chart/charts/active-users.js';
import { NoteSchema } from '@/models/zod/NoteSchema.js';
import { MisskeyIdSchema, PaginationSchema, limit } from '@/models/zod/misc.js';
import { PrismaService } from '@/core/PrismaService.js';
import { PrismaQueryService } from '@/core/PrismaQueryService.js';
import { ApiError } from '../../error.js';

const res = z.array(NoteSchema);
export const meta = {
	tags: ['notes', 'lists'],
	requireCredential: true,
	res,
	errors: { noSuchList: noSuchList },
} as const;

export const paramDef = z
	.object({
		listId: MisskeyIdSchema,
		limit: limit({ max: 100, default: 10 }),
		includeMyRenotes: z.boolean().default(true),
		includeRenotedMyNotes: z.boolean().default(true),
		includeLocalRenotes: z.boolean().default(true),
		withFiles: z
			.boolean()
			.default(false)
			.describe('Only show notes that have attached files.'),
	})
	.merge(PaginationSchema.pick({ sinceId: true, untilId: true }));

@Injectable()
// eslint-disable-next-line import/no-default-export
export default class extends Endpoint<
	typeof meta,
	typeof paramDef,
	typeof res
> {
	constructor(
		private readonly noteEntityService: NoteEntityPackService,
		private readonly activeUsersChart: ActiveUsersChart,
		private readonly prismaService: PrismaService,
		private readonly prismaQueryService: PrismaQueryService,
	) {
		super(meta, paramDef, async (ps, me) => {
			const list = await this.prismaService.client.user_list.findUnique({
				where: {
					id: ps.listId,
					userId: me.id,
				},
			});

			if (list == null) {
				throw new ApiError(meta.errors.noSuchList);
			}

			const paginationQuery = this.prismaQueryService.getPaginationQuery({
				sinceId: ps.sinceId,
				untilId: ps.untilId,
			});

			const timeline = await this.prismaService.client.note.findMany({
				where: {
					AND: [
						{ user: { userListJoinings: { some: { userListId: list.id } } } },
						this.prismaQueryService.getVisibilityWhereForNote(me.id),
						ps.includeMyRenotes
							? {}
							: {
									OR: [
										{ userId: me.id },
										{ renoteId: null },
										{ text: { not: null } },
										{ fileIds: { isEmpty: false } },
										{ hasPoll: true },
									],
							  },
						ps.includeRenotedMyNotes
							? {}
							: {
									OR: [
										{ renoteUserId: me.id },
										{ renoteId: null },
										{ text: { not: null } },
										{ fileIds: { isEmpty: false } },
										{ hasPoll: true },
									],
							  },
						ps.includeLocalRenotes
							? {}
							: {
									OR: [
										{ renoteUserHost: { not: null } },
										{ renoteId: null },
										{ text: { not: null } },
										{ fileIds: { isEmpty: false } },
										{ hasPoll: true },
									],
							  },
						ps.withFiles ? { fileIds: { isEmpty: false } } : {},
					],
				},
				orderBy: paginationQuery.orderBy,
				take: ps.limit,
			});

			this.activeUsersChart.read(me);

			return await this.noteEntityService.packMany(timeline, me);
		});
	}
}
