import { Injectable } from '@nestjs/common';
import { bindThis } from '@/decorators.js';
import { PrismaService } from '@/core/PrismaService.js';
import { NoteEntityService } from './NoteEntityService.js';
import type { note_favorite, user } from '@prisma/client';

@Injectable()
export class NoteFavoriteEntityService {
	constructor(
		private readonly noteEntityService: NoteEntityService,
		private readonly prismaService: PrismaService,
	) {}

	@bindThis
	public async pack(
		src: note_favorite['id'] | note_favorite,
		me?: { id: user['id'] } | null | undefined,
	) {
		const favorite =
			typeof src === 'object'
				? src
				: await this.prismaService.client.note_favorite.findUniqueOrThrow({ where: { id: src } });

		return {
			id: favorite.id,
			createdAt: favorite.createdAt.toISOString(),
			noteId: favorite.noteId,
			note: await this.noteEntityService.pack(favorite.noteId, me),
		};
	}
}
