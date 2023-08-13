import { Injectable } from '@nestjs/common';
import type {} from '@/models/entities/Blocking.js';
import type { User } from '@/models/entities/User.js';
import type { NoteFavorite } from '@/models/entities/NoteFavorite.js';
import { bindThis } from '@/decorators.js';
import { PrismaService } from '@/core/PrismaService.js';
import { NoteEntityService } from './NoteEntityService.js';
import type { note_favorite } from '@prisma/client';

@Injectable()
export class NoteFavoriteEntityService {
	constructor(
		private readonly noteEntityService: NoteEntityService,
		private readonly prismaService: PrismaService,
	) {}

	@bindThis
	public async pack(
		src: NoteFavorite['id'] | note_favorite,
		me?: { id: User['id'] } | null | undefined,
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
