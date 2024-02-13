import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/core/PrismaService.js';
import type { NoteSchema } from '@/models/zod/NoteSchema.js';
import { NoteEntityPackService } from './NoteEntityPackService.js';
import type { NoteFavorite, User } from '@prisma/client';
import type { z } from 'zod';

@Injectable()
export class NoteFavoriteEntityService {
	constructor(
		private readonly noteEntityService: NoteEntityPackService,
		private readonly prismaService: PrismaService,
	) {}

	/**
	 * `note_favorite`をpackする。
	 *
	 * @param src
	 * @param me
	 * @returns
	 */
	public async pack(
		src: NoteFavorite['id'] | NoteFavorite,
		me?: { id: User['id'] } | null | undefined,
	): Promise<{
		id: string;
		createdAt: string;
		noteId: string;
		note: z.infer<typeof NoteSchema>;
	}> {
		const favorite =
			typeof src === 'object'
				? src
				: await this.prismaService.client.noteFavorite.findUniqueOrThrow({
						where: { id: src },
				  });

		return {
			id: favorite.id,
			createdAt: favorite.createdAt.toISOString(),
			noteId: favorite.noteId,
			note: await this.noteEntityService.pack(favorite.noteId, me),
		};
	}
}
