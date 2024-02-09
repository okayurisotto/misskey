import { Injectable } from '@nestjs/common';
import { ApNoteIdResolverService } from '../ApNoteIdResolverService.js';
import type { IObject } from '../type.js';
import type { Note } from '@prisma/client';

@Injectable()
export class ApNoteFetchService {
	constructor(
		private readonly apNoteIdResolverService: ApNoteIdResolverService,
	) {}

	/**
	 * Noteをフェッチします。
	 *
	 * Misskeyに対象のNoteが登録されていればそれを返します。
	 */
	public async fetch(object: string | IObject): Promise<Note | null> {
		return await this.apNoteIdResolverService.getNoteFromApId(object);
	}
}
