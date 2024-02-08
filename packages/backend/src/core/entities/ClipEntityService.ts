import { Injectable } from '@nestjs/common';
import { pick } from 'omick';
import type { ClipSchema } from '@/models/zod/ClipSchema.js';
import { PrismaService } from '@/core/PrismaService.js';
import type { PartiallyPartial } from '@/types.js';
import { UserEntityPackLiteService } from './UserEntityPackLiteService.js';
import type { z } from 'zod';
import type { Clip, user } from '@prisma/client';

@Injectable()
export class ClipEntityService {
	constructor(
		private readonly prismaService: PrismaService,
		private readonly userEntityPackLiteService: UserEntityPackLiteService,
	) {}

	/**
	 * `clip`をpackする。
	 *
	 * @param src
	 * @param me  渡された場合、返り値の`isFavorited`が`undefined`でなくなる。
	 * @returns
	 */
	public async pack(
		src: Clip['id'] | Clip,
		me?: { id: user['id'] } | null | undefined,
	): Promise<z.infer<typeof ClipSchema>> {
		const meId = me ? me.id : null;
		const clip_ = await this.prismaService.client.clip.findUniqueOrThrow({
			where: { id: typeof src === 'string' ? src : src.id },
			include: {
				user: true,
				...(meId !== null ? { favorites: { where: { userId: meId } } } : {}),
				_count: { select: { favorites: true } },
			},
		});
		// Prismaによる型定義が間違っているので
		const clip = clip_ as PartiallyPartial<typeof clip_, 'favorites'>;

		const packedUser = await this.userEntityPackLiteService.packLite(clip.user);

		return {
			...pick(clip, ['id', 'userId', 'name', 'description', 'isPublic']),
			createdAt: clip.createdAt.toISOString(),
			lastClippedAt: clip.lastClippedAt?.toISOString() ?? null,
			favoritedCount: clip._count.favorites,
			user: packedUser,
			...(meId !== null
				? { isFavorited: clip.favorites ? clip.favorites.length > 0 : false }
				: {}),
		};
	}
}
