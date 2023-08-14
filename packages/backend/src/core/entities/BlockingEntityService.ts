import { Injectable } from '@nestjs/common';
import { bindThis } from '@/decorators.js';
import type { BlockingSchema } from '@/models/zod/BlockingSchema.js';
import { PrismaService } from '@/core/PrismaService.js';
import { UserEntityService } from './UserEntityService.js';
import type z from 'zod';
import type { blocking, user } from '@prisma/client';

@Injectable()
export class BlockingEntityService {
	constructor(
		private readonly userEntityService: UserEntityService,
		private readonly prismaService: PrismaService,
	) {}

	/**
	 * `blocking`をpackする。
	 *
	 * @param src
	 * @param me
	 * @returns
	 */
	@bindThis
	public async pack(
		src: blocking['id'] | blocking,
		me?: { id: user['id'] } | null | undefined,
	): Promise<z.infer<typeof BlockingSchema>> {
		const blocking = typeof src === 'object'
			? src
			: await this.prismaService.client.blocking.findUniqueOrThrow({ where: { id: src } });

		return {
			id: blocking.id,
			createdAt: blocking.createdAt.toISOString(),
			blockeeId: blocking.blockeeId,
			blockee: await this.userEntityService.pack(blocking.blockeeId, me, { detail: true }),
		};
	}
}
