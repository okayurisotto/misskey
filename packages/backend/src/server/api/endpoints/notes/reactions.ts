import { Injectable } from '@nestjs/common';
import z from 'zod';
import { noSuchNote___________ } from '@/server/api/errors.js';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import { NoteReactionEntityService } from '@/core/entities/NoteReactionEntityService.js';
import { NoteReactionSchema } from '@/models/zod/NoteReactionSchema.js';
import { MisskeyIdSchema, PaginationSchema, limit } from '@/models/zod/misc.js';
import { PrismaService } from '@/core/PrismaService.js';
import type { Prisma } from '@prisma/client';

const res = z.array(NoteReactionSchema);
export const meta = {
	tags: ['notes', 'reactions'],
	requireCredential: false,
	allowGet: true,
	cacheSec: 60,
	res,
	errors: { noSuchNote: noSuchNote___________ },
} as const;

export const paramDef = z
	.object({
		noteId: MisskeyIdSchema,
		type: z.string().nullable().optional(),
		limit: limit({ max: 100, default: 10 }),
		offset: z.number().int().default(0),
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
		private readonly noteReactionEntityService: NoteReactionEntityService,
		private readonly prismaService: PrismaService,
	) {
		super(meta, paramDef, async (ps, me) => {
			const query: Prisma.NoteReactionWhereInput = {
				noteId: ps.noteId,
			};

			if (ps.type) {
				// ローカルリアクションはホスト名が . とされているが
				// DB 上ではそうではないので、必要に応じて変換
				const suffix = '@.:';
				const type = ps.type.endsWith(suffix)
					? ps.type.slice(0, ps.type.length - suffix.length) + ':'
					: ps.type;
				query.reaction = type;
			}

			const reactions = await this.prismaService.client.noteReaction.findMany({
				where: query,
				take: ps.limit,
				skip: ps.offset,
				orderBy: { id: 'desc' },
			});

			return await Promise.all(
				reactions.map((reaction) =>
					this.noteReactionEntityService.pack(reaction, me),
				),
			);
		});
	}
}
