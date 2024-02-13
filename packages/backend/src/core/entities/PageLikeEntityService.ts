import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/core/PrismaService.js';
import type { PageSchema } from '@/models/zod/PageSchema.js';
import { PageEntityService } from './PageEntityService.js';
import type { PageLike, User } from '@prisma/client';
import type { z } from 'zod';

@Injectable()
export class PageLikeEntityService {
	constructor(
		private readonly pageEntityService: PageEntityService,
		private readonly prismaService: PrismaService,
	) {}

	/**
	 * `page_like`をpackする。
	 *
	 * @param src
	 * @param me
	 * @returns
	 */
	public async pack(
		src: PageLike['id'] | PageLike,
		me?: { id: User['id'] } | null | undefined,
	): Promise<{ id: string; page: z.infer<typeof PageSchema> }> {
		const like =
			typeof src === 'object'
				? src
				: await this.prismaService.client.pageLike.findUniqueOrThrow({
						where: { id: src },
				  });

		return {
			id: like.id,
			page: await this.pageEntityService.pack(like.pageId, me),
		};
	}
}
