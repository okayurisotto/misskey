import { z } from 'zod';
import { Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import { NoteEntityService } from '@/core/entities/NoteEntityService.js';
import { NoteSchema } from '@/models/zod/NoteSchema.js';
import { MisskeyIdSchema } from '@/models/zod/misc.js';
import { PrismaService } from '@/core/PrismaService.js';
import { PrismaQueryService } from '@/core/PrismaQueryService.js';

const res = z.array(NoteSchema);
export const meta = {
	tags: ['notes'],
	res,
} as const;

export const paramDef = z.object({
	local: z.boolean().default(false),
	reply: z.boolean().optional(),
	renote: z.boolean().optional(),
	withFiles: z.boolean().optional(),
	poll: z.boolean().optional(),
	limit: z.number().int().min(1).max(100).default(10),
	sinceId: MisskeyIdSchema.optional(),
	untilId: MisskeyIdSchema.optional(),
});

@Injectable()
// eslint-disable-next-line import/no-default-export
export default class extends Endpoint<
	typeof meta,
	typeof paramDef,
	typeof res
> {
	constructor(
		private readonly noteEntityService: NoteEntityService,
		private readonly prismaService: PrismaService,
		private readonly prismaQueryService: PrismaQueryService,
	) {
		super(meta, paramDef, async (ps, me) => {
			const paginationQuery = this.prismaQueryService.getPaginationQuery({
				sinceId: ps.sinceId,
				untilId: ps.untilId,
			});
			const notes = await this.prismaService.client.note.findMany({
				where: {
					AND: [
						paginationQuery.where,
						{ visibility: 'public', localOnly: false },
						ps.local ? { userHost: null } : {},
						ps.reply !== undefined
							? ps.reply
								? { replyId: { not: null } }
								: { replyId: null }
							: {},
						ps.renote !== undefined
							? ps.renote
								? { renoteId: { not: null } }
								: { renoteId: null }
							: {},
						ps.withFiles !== undefined
							? { fileIds: { isEmpty: !ps.withFiles } }
							: {},
						ps.poll !== undefined ? { hasPoll: ps.poll } : {},
					],
				},
				orderBy: paginationQuery.orderBy,
				take: ps.limit,
			});

			return (await this.noteEntityService.packMany(notes)) satisfies z.infer<
				typeof res
			>;
		});
	}
}
