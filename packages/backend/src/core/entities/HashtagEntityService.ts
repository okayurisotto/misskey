import { Injectable } from '@nestjs/common';
import type { HashtagSchema } from '@/models/zod/HashtagSchema.js';
import type { z } from 'zod';
import type { Hashtag } from '@prisma/client';

@Injectable()
export class HashtagEntityService {
	/**
	 * `hashtag`をpackする。
	 *
	 * @param src
	 * @returns
	 */
	public async pack(src: Hashtag): Promise<z.infer<typeof HashtagSchema>> {
		return {
			tag: src.name,
			mentionedUsersCount: src.mentionedUsersCount,
			mentionedLocalUsersCount: src.mentionedLocalUsersCount,
			mentionedRemoteUsersCount: src.mentionedRemoteUsersCount,
			attachedUsersCount: src.attachedUsersCount,
			attachedLocalUsersCount: src.attachedLocalUsersCount,
			attachedRemoteUsersCount: src.attachedRemoteUsersCount,
		};
	}
}
