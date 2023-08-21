import { ltlDisabled } from '@/server/api/errors.js';
import { z } from 'zod';
import { Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import { NoteEntityService } from '@/core/entities/NoteEntityService.js';
import ActiveUsersChart from '@/core/chart/charts/active-users.js';
import { RoleService } from '@/core/RoleService.js';
import { IdService } from '@/core/IdService.js';
import { ApiError } from '../../error.js';
import { NoteSchema } from '@/models/zod/NoteSchema.js';
import { MisskeyIdSchema, PaginationSchema, limit } from '@/models/zod/misc.js';
import { PrismaService } from '@/core/PrismaService.js';
import { PrismaQueryService } from '@/core/PrismaQueryService.js';

const res = z.array(NoteSchema);
export const meta = {
	tags: ['notes'],
	res,
	errors: { ltlDisabled: ltlDisabled },
} as const;

export const paramDef = z
	.object({
		withFiles: z.boolean().default(false),
		withReplies: z.boolean().default(false),
		fileType: z.array(z.string()).optional(),
		excludeNsfw: z.boolean().default(false),
		limit: limit({ max: 100, default: 10 }),
	})
	.merge(PaginationSchema);

@Injectable()
// eslint-disable-next-line import/no-default-export
export default class extends Endpoint<
	typeof meta,
	typeof paramDef,
	typeof res
> {
	constructor(
		private noteEntityService: NoteEntityService,
		private roleService: RoleService,
		private activeUsersChart: ActiveUsersChart,
		private idService: IdService,
		private prismaService: PrismaService,
		private prismaQueryService: PrismaQueryService,
	) {
		super(meta, paramDef, async (ps, me) => {
			const policies = await this.roleService.getUserPolicies(
				me ? me.id : null,
			);
			if (!policies.ltlAvailable) {
				throw new ApiError(meta.errors.ltlDisabled);
			}

			const paginationQuery = this.prismaQueryService.getPaginationQuery({
				sinceId: ps.sinceId,
				untilId: ps.untilId,
				sinceDate: ps.sinceDate,
				untilDate: ps.untilDate,
			});

			const sensitiveDriveFileIds = (
				await this.prismaService.client.drive_file.findMany({
					where: { isSensitive: true },
					select: { id: true },
				})
			).map(({ id }) => id);

			const timeline = await this.prismaService.client.note.findMany({
				where: {
					AND: [
						paginationQuery.where,
						{
							id: {
								gt: this.idService.genId(
									new Date(Date.now() - 1000 * 60 * 60 * 24 * 10),
								),
							},
						},
						{ visibility: 'public' },
						{ userHost: null },
						this.prismaQueryService.getChannelWhereForNote(me?.id ?? null),
						this.prismaQueryService.getRepliesWhereForNote(me?.id ?? null),
						this.prismaQueryService.getVisibilityWhereForNote(me?.id ?? null),
						...(me
							? [
									await this.prismaQueryService.getMutingWhereForNote(me.id),
									await this.prismaQueryService.getNoteThreadMutingWhereForNote(
										me.id,
									),
									this.prismaQueryService.getBlockedWhereForNote(me.id),
									await this.prismaQueryService.getRenoteMutingWhereForNote(
										me.id,
									),
							  ]
							: []),
						ps.withFiles ? { fileIds: { isEmpty: false } } : {},
						ps.fileType == null
							? {}
							: {
									fileIds: { isEmpty: false },
									attachedFileTypes: { hasSome: ps.fileType },
									...(ps.excludeNsfw
										? {
												cw: null,
												NOT: { fileIds: { hasSome: sensitiveDriveFileIds } },
										  }
										: {}),
							  },
					],
				},
				orderBy: paginationQuery.orderBy,
				take: ps.limit,
			});

			process.nextTick(() => {
				if (me) {
					this.activeUsersChart.read(me);
				}
			});

			return (await this.noteEntityService.packMany(
				timeline,
				me,
			)) satisfies z.infer<typeof res>;
		});
	}
}
