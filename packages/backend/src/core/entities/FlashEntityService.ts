import { Injectable } from '@nestjs/common';
import { awaitAll } from '@/misc/prelude/await-all.js';
import type { FlashSchema } from '@/models/zod/FlashSchema.js';
import { PrismaService } from '@/core/PrismaService.js';
import { UserEntityService } from './UserEntityService.js';
import type { z } from 'zod';
import type { flash, user } from '@prisma/client';

@Injectable()
export class FlashEntityService {
	constructor(
		private readonly prismaService: PrismaService,
		private readonly userEntityService: UserEntityService,
	) {}

	/**
	 * `flash`をpackする。
	 *
	 * @param src
	 * @param me 渡された場合、返り値に`isLiked`が含まれるようになる。
	 * @returns
	 */
	public async pack(
		src: flash['id'] | flash,
		me?: { id: user['id'] } | null | undefined,
	): Promise<z.infer<typeof FlashSchema>> {
		const meId = me ? me.id : null;
		const flash = await this.prismaService.client.flash.findUniqueOrThrow({
			where: { id: typeof src === 'string' ? src : src.id },
			include: { user: true },
		});

		const result = await awaitAll({
			user: () => this.userEntityService.packLite(flash.user),
			isLiked: async () =>
				meId
					? await this.prismaService.client.flash_like.count({
							where: { flashId: flash.id, userId: meId },
							take: 1,
					  }) > 0
					: undefined,
		});

		return {
			id: flash.id,
			createdAt: flash.createdAt.toISOString(),
			updatedAt: flash.updatedAt.toISOString(),
			userId: flash.userId,
			user: result.user,
			title: flash.title,
			summary: flash.summary,
			script: flash.script,
			likedCount: flash.likedCount,
			isLiked: result.isLiked,
		};
	}
}
