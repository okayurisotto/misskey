import { Injectable } from '@nestjs/common';
import type { Blocking } from '@/models/entities/Blocking.js';
import type { User } from '@/models/entities/User.js';
import { bindThis } from '@/decorators.js';
import type { BlockingSchema } from '@/models/zod/BlockingSchema.js';
import { PrismaService } from '@/core/PrismaService.js';
import { UserEntityService } from './UserEntityService.js';
import type z from 'zod';
import type { blocking } from '@prisma/client';

@Injectable()
export class BlockingEntityService {
	constructor(
		private readonly userEntityService: UserEntityService,
		private readonly prismaService: PrismaService,
	) {}

	@bindThis
	public async pack(
		src: Blocking['id'] | blocking,
		me?: { id: User['id'] } | null | undefined,
	): Promise<z.infer<typeof BlockingSchema>> {
		const blocking =
			typeof src === 'object'
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
