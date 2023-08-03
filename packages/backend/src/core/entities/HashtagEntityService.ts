import { Inject, Injectable } from '@nestjs/common';
import { DI } from '@/di-symbols.js';
import type { HashtagsRepository } from '@/models/index.js';
import type {} from '@/models/entities/Blocking.js';
import type { Hashtag } from '@/models/entities/Hashtag.js';
import { bindThis } from '@/decorators.js';
import type { HashtagSchema } from '@/models/zod/HashtagSchema.js';
import { UserEntityService } from './UserEntityService.js';
import type { z } from 'zod';

@Injectable()
export class HashtagEntityService {
	constructor(
		@Inject(DI.hashtagsRepository)
		private hashtagsRepository: HashtagsRepository,

		private userEntityService: UserEntityService,
	) {}

	@bindThis
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
