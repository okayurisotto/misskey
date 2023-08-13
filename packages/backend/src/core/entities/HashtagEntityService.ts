import { Injectable } from '@nestjs/common';
import type { Hashtag } from '@/models/entities/Hashtag.js';
import { bindThis } from '@/decorators.js';
import type { HashtagSchema } from '@/models/zod/HashtagSchema.js';
import type { z } from 'zod';
import type { hashtag } from '@prisma/client';

@Injectable()
export class HashtagEntityService {
	constructor() {}

	@bindThis
	public async pack(
		src: hashtag,
	): Promise<z.infer<typeof HashtagSchema>> {
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
