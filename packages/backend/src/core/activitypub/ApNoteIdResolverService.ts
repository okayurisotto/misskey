import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/core/PrismaService.js';
import { ApUriParseService } from './ApUriParseService.js';
import type { Note } from '@prisma/client';
import type { IObject } from './type.js';

@Injectable()
export class ApNoteIdResolverService {
	constructor(
		private readonly apUriParseService: ApUriParseService,
		private readonly prismaService: PrismaService,
	) {}

	/**
	 * AP Note => Misskey Note in DB
	 */
	public async getNoteFromApId(value: string | IObject): Promise<Note | null> {
		const parsed = this.apUriParseService.parse(value);

		if (parsed.local) {
			if (parsed.type !== 'notes') return null;

			return await this.prismaService.client.note.findUnique({
				where: { id: parsed.id },
			});
		} else {
			return await this.prismaService.client.note.findFirst({
				where: { uri: parsed.uri },
			});
		}
	}
}
