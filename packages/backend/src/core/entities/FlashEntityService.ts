import { Injectable } from '@nestjs/common';
import { awaitAll } from '@/misc/prelude/await-all.js';
import type {} from '@/models/entities/Blocking.js';
import type { User } from '@/models/entities/User.js';
import type { Flash } from '@/models/entities/Flash.js';
import { bindThis } from '@/decorators.js';
import type { FlashSchema } from '@/models/zod/FlashSchema.js';
import { PrismaService } from '@/core/PrismaService.js';
import { UserEntityService } from './UserEntityService.js';
import type { z } from 'zod';
import type { flash } from '@prisma/client';

@Injectable()
export class FlashEntityService {
	constructor(
		private readonly prismaService: PrismaService,
		private readonly userEntityService: UserEntityService,
	) {}

	@bindThis
	public async pack(
		src: Flash['id'] | flash,
		me?: { id: User['id'] } | null | undefined,
	): Promise<z.infer<typeof FlashSchema>> {
		const meId = me ? me.id : null;
		const flash =
			typeof src === 'object'
				? src
				: await this.prismaService.client.flash.findUniqueOrThrow({ where: { id: src } });

		const result = await awaitAll({
			user: () => this.userEntityService.pack(flash.userId, me), // { detail: true } すると無限ループするので注意
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
