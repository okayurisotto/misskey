import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/core/PrismaService.js';
import type { FlashSchema } from '@/models/zod/FlashSchema.js';
import { FlashEntityService } from './FlashEntityService.js';
import type { FlashLike, user } from '@prisma/client';
import type { z } from 'zod';

@Injectable()
export class FlashLikeEntityService {
	constructor(
		private readonly flashEntityService: FlashEntityService,
		private readonly prismaService: PrismaService,
	) {}

	/**
	 * `FlashLike`をpackする。
	 *
	 * @param src
	 * @param me
	 * @returns
	 */
	public async pack(
		src: FlashLike['id'] | FlashLike,
		me?: { id: user['id'] } | null | undefined,
	): Promise<{ id: string; flash: z.infer<typeof FlashSchema> }> {
		const like =
			typeof src === 'object'
				? src
				: await this.prismaService.client.flashLike.findUniqueOrThrow({
						where: { id: src },
				  });

		return {
			id: like.id,
			flash: await this.flashEntityService.pack(like.flashId, me),
		};
	}
}
