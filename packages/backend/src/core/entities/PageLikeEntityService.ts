import { Injectable } from '@nestjs/common';
import type { User } from '@/models/entities/User.js';
import type { PageLike } from '@/models/entities/PageLike.js';
import { bindThis } from '@/decorators.js';
import { PrismaService } from '@/core/PrismaService.js';
import { PageEntityService } from './PageEntityService.js';
import type { page_like } from '@prisma/client';

@Injectable()
export class PageLikeEntityService {
	constructor(
		private readonly pageEntityService: PageEntityService,
		private readonly prismaService: PrismaService,
	) {}

	@bindThis
	public async pack(
		src: PageLike['id'] | page_like,
		me?: { id: User['id'] } | null | undefined,
	) {
		const like =
			typeof src === 'object'
				? src
				: await this.prismaService.client.page_like.findUniqueOrThrow({ where: { id: src } });

		return {
			id: like.id,
			page: await this.pageEntityService.pack(like.pageId, me),
		};
	}
}
