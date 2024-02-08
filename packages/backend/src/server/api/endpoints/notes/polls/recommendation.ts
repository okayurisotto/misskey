import { z } from 'zod';
import { Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import { NoteEntityPackService } from '@/core/entities/NoteEntityPackService.js';
import { NoteSchema } from '@/models/zod/NoteSchema.js';
import { PrismaService } from '@/core/PrismaService.js';
import { limit } from '@/models/zod/misc.js';

const res = z.array(NoteSchema);
export const meta = {
	tags: ['notes'],
	requireCredential: true,
	res,
} as const;

export const paramDef = z.object({
	limit: limit({ max: 100, default: 10 }),
	offset: z.number().int().default(0),
});

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
	) {
		super(meta, paramDef, async (ps, me) => {
			const mutings = await this.prismaService.client.userMuting.findMany({
				where: { muterId: me.id },
				select: { muteeId: true },
			});

			const polls = await this.prismaService.client.poll.findMany({
				where: {
					AND: [
						{ note: { poll_vote: { none: { userId: { contains: me.id } } } } },
						{ noteVisibility: 'public' },
						{ OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] },
						{ userHost: null },
						{ userId: { notIn: mutings.map((muting) => muting.muteeId) } },
						{ userId: me.id },
					],
				},
				orderBy: { noteId: 'desc' },
				take: ps.limit,
				skip: ps.offset,
			});

			if (polls.length === 0) return [];

			const notes = await this.prismaService.client.note.findMany({
				where: {
					id: { in: polls.map((poll) => poll.noteId) },
				},
				orderBy: {
					createdAt: 'desc',
				},
			});

			return await this.noteEntityService.packMany(notes, me, {
				detail: true,
			});
		});
	}
}
