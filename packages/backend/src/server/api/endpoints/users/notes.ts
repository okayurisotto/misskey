import { z } from 'zod';
import { Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import { NoteEntityPackService } from '@/core/entities/NoteEntityPackService.js';
import { NoteSchema } from '@/models/zod/NoteSchema.js';
import { MisskeyIdSchema, PaginationSchema, limit } from '@/models/zod/misc.js';
import { PrismaService } from '@/core/PrismaService.js';
import { PrismaQueryService } from '@/core/PrismaQueryService.js';

const res = z.array(NoteSchema);
export const meta = {
	tags: ['users', 'notes'],
	description: 'Show all notes that this user created.',
	res,
} as const;

export const paramDef = z
	.object({
		userId: MisskeyIdSchema,
		includeReplies: z.boolean().default(true),
		limit: limit({ max: 100, default: 10 }),
		includeMyRenotes: z.boolean().default(true),
		withFiles: z.boolean().default(false),
		fileType: z.array(z.string()).optional(),
		excludeNsfw: z.boolean().default(false),
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
		private readonly noteEntityService: NoteEntityPackService,
		private readonly prismaService: PrismaService,
		private readonly prismaQueryService: PrismaQueryService,
	) {
		super(meta, paramDef, async (ps, me) => {
			const paginationQuery = this.prismaQueryService.getPaginationQuery({
				sinceId: ps.sinceId,
				untilId: ps.untilId,
				sinceDate: ps.sinceDate,
				untilDate: ps.untilDate,
			});

			const getSensitiveDriveFileIds = async (): Promise<string[]> => {
				return (
					await this.prismaService.client.driveFile.findMany({
						where: { isSensitive: true },
						select: { id: true },
					})
				).map(({ id }) => id);
			};

			const timeline = await this.prismaService.client.note.findMany({
				where: {
					AND: [
						paginationQuery.where,
						{ userId: ps.userId },
						this.prismaQueryService.getVisibilityWhereForNote(me?.id ?? null),
						...(me
							? [
									await this.prismaQueryService.getMutingWhereForNote(me.id),
									this.prismaQueryService.getBlockedWhereForNote(me.id),
							  ]
							: []),
						ps.withFiles ? { fileIds: { isEmpty: false } } : {},
						ps.fileType != null
							? {
									fileIds: { isEmpty: false },
									attachedFileTypes: { hasSome: ps.fileType },
									...(ps.excludeNsfw
										? {
												cw: null,
												NOT: {
													fileIds: {
														hasSome: await getSensitiveDriveFileIds(),
													},
												},
										  }
										: {}),
							  }
							: {},
						ps.includeReplies ? {} : { replyId: null },
						ps.includeMyRenotes
							? {}
							: {
									OR: [
										{ userId: ps.userId },
										{ renoteId: null },
										{ text: { not: null } },
										{ fileIds: { isEmpty: false } },
										{ hasPoll: true },
									],
							  },
					],
				},
				orderBy: paginationQuery.orderBy,
				take: ps.limit,
			});

			return await this.noteEntityService.packMany(timeline, me);
		});
	}
}
