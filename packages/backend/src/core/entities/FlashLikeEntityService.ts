import { Injectable } from '@nestjs/common';
import type {} from '@/models/entities/Blocking.js';
import type { User } from '@/models/entities/User.js';
import type { FlashLike } from '@/models/entities/FlashLike.js';
import { bindThis } from '@/decorators.js';
import { PrismaService } from '@/core/PrismaService.js';
import { FlashEntityService } from './FlashEntityService.js';
import type { flash_like } from '@prisma/client';

@Injectable()
export class FlashLikeEntityService {
	constructor(
		private readonly flashEntityService: FlashEntityService,
		private readonly prismaService: PrismaService,
	) {}

	@bindThis
	public async pack(
		src: FlashLike['id'] | flash_like,
		me?: { id: User['id'] } | null | undefined,
	) {
		const like =
			typeof src === 'object'
				? src
				: await this.prismaService.client.flash_like.findUniqueOrThrow({ where: { id: src } });

		return {
			id: like.id,
			flash: await this.flashEntityService.pack(like.flashId, me),
		};
	}
}
