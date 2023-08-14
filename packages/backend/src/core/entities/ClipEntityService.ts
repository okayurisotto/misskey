import { Injectable } from '@nestjs/common';
import { awaitAll } from '@/misc/prelude/await-all.js';
import { bindThis } from '@/decorators.js';
import type { ClipSchema } from '@/models/zod/ClipSchema.js';
import { PrismaService } from '@/core/PrismaService.js';
import { UserEntityService } from './UserEntityService.js';
import type { z } from 'zod';
import type { clip, user } from '@prisma/client';

@Injectable()
export class ClipEntityService {
	constructor(
		private readonly userEntityService: UserEntityService,
		private readonly prismaService: PrismaService,
	) {}

	@bindThis
	public async pack(
		src: clip['id'] | clip,
		me?: { id: user['id'] } | null | undefined,
	): Promise<z.infer<typeof ClipSchema>> {
		const meId = me ? me.id : null;
		const clip =
			typeof src === 'object'
				? src
				: await this.prismaService.client.clip.findUniqueOrThrow({ where: { id: src } });

		const result = await awaitAll({
			user: () => this.userEntityService.pack(clip.userId),
			favoritedCount: () =>
				this.prismaService.client.clip_favorite.count({ where: { clipId: clip.id } }),
			isFavorited: async () =>
				meId
					? (await this.prismaService.client.clip_favorite.count({
						where: { clipId: clip.id, userId: meId },
						take: 1,
					})) > 0
					: undefined,
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
