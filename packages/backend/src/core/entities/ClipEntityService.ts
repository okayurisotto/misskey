import { Inject, Injectable } from '@nestjs/common';
import { DI } from '@/di-symbols.js';
import type {
	ClipFavoritesRepository,
	ClipsRepository,
	User,
} from '@/models/index.js';
import { awaitAll } from '@/misc/prelude/await-all.js';
import type {} from '@/models/entities/Blocking.js';
import type { Clip } from '@/models/entities/Clip.js';
import { bindThis } from '@/decorators.js';
import type { ClipSchema } from '@/models/zod/ClipSchema.js';
import { UserEntityService } from './UserEntityService.js';
import type { z } from 'zod';

@Injectable()
export class ClipEntityService {
	constructor(
		@Inject(DI.clipsRepository)
		private clipsRepository: ClipsRepository,

		@Inject(DI.clipFavoritesRepository)
		private clipFavoritesRepository: ClipFavoritesRepository,

		private userEntityService: UserEntityService,
	) {}

	@bindThis
	public async pack(
		src: Clip['id'] | Clip,
		me?: { id: User['id'] } | null | undefined,
	): Promise<z.infer<typeof ClipSchema>> {
		const meId = me ? me.id : null;
		const clip =
			typeof src === 'object'
				? src
				: await this.clipsRepository.findOneByOrFail({ id: src });

		const result = await awaitAll({
			user: () => this.userEntityService.pack(clip.user ?? clip.userId),
			favoritedCount: () =>
				this.clipFavoritesRepository.countBy({ clipId: clip.id }),
			isFavorited: () =>
				meId
					? this.clipFavoritesRepository.exist({
							where: { clipId: clip.id, userId: meId },
					  })
					: Promise.resolve(undefined),
		});

		return {
			id: clip.id,
			createdAt: clip.createdAt.toISOString(),
			lastClippedAt: clip.lastClippedAt
				? clip.lastClippedAt.toISOString()
				: null,
			userId: clip.userId,
			user: result.user,
			name: clip.name,
			description: clip.description,
			isPublic: clip.isPublic,
			favoritedCount: result.favoritedCount,
			isFavorited: result.isFavorited,
		};
	}
}
