import { z } from 'zod';
import { Injectable } from '@nestjs/common';
import { noSuchUser________________________ } from '@/server/api/errors.js';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import { NoteEntityService } from '@/core/entities/NoteEntityService.js';
import { GetterService } from '@/server/api/GetterService.js';
import { NoteSchema } from '@/models/zod/NoteSchema.js';
import { MisskeyIdSchema, PaginationSchema, limit } from '@/models/zod/misc.js';
import { PrismaService } from '@/core/PrismaService.js';
import { PrismaQueryService } from '@/core/PrismaQueryService.js';
import { ApiError } from '../../error.js';

const res = z.array(NoteSchema);
export const meta = {
	tags: ['users', 'notes'],
	description: 'Show all notes that this user created.',
	res,
	errors: { noSuchUser: noSuchUser________________________ },
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
		private readonly noteEntityService: NoteEntityService,
		private readonly getterService: GetterService,
		private readonly prismaService: PrismaService,
		private readonly prismaQueryService: PrismaQueryService,
	) {
		super(meta, paramDef, async (ps, me) => {
			// Lookup user
			const user = await this.getterService.getUser(ps.userId).catch((err) => {
				if (err.id === '15348ddd-432d-49c2-8a5a-8069753becff') {
					throw new ApiError(meta.errors.noSuchUser);
				}
				throw err;
			});

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
						{ userId: user.id },
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
												NOT: { fileIds: { hasSome: sensitiveDriveFileIds } },
										  }
										: {}),
							  }
							: {},
						ps.includeMyRenotes ? { replyId: null } : {},
						ps.includeMyRenotes
							? {
									OR: [
										{ userId: user.id },
										{ renoteId: null },
										{ text: { not: null } },
										{ fileIds: { isEmpty: false } },
										{ hasPoll: true },
									],
							  }
							: {},
					],
				},
				orderBy: paginationQuery.orderBy,
				take: ps.limit,
			});

			return (await this.noteEntityService.packMany(
				timeline,
				me,
			)) satisfies z.infer<typeof res>;
		});
	}
}
