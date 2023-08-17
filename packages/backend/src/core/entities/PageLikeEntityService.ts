import { Injectable } from '@nestjs/common';
import { bindThis } from '@/decorators.js';
import { PrismaService } from '@/core/PrismaService.js';
import type { PageSchema } from '@/models/zod/PageSchema.js';
import { PageEntityService } from './PageEntityService.js';
import type { page_like, user } from '@prisma/client';
import type { z } from 'zod';

@Injectable()
export class PageLikeEntityService {
	constructor(
		private readonly pageEntityService: PageEntityService,
		private readonly prismaService: PrismaService,
	) {}

	@bindThis
	public async pack(
		src: page_like['id'] | page_like,
		me?: { id: user['id'] } | null | undefined,
	): Promise<{ id: string; page: z.infer<typeof PageSchema> }> {
		const like = typeof src === 'object'
			? src
			: await this.prismaService.client.page_like.findUniqueOrThrow({ where: { id: src } });

		return {
			id: like.id,
			page: await this.pageEntityService.pack(like.pageId, me),
		};
	}
}
