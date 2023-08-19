import { Injectable } from '@nestjs/common';
import { bindThis } from '@/decorators.js';
import type { MutingSchema } from '@/models/zod/MutingSchema.js';
import { PrismaService } from '@/core/PrismaService.js';
import { UserEntityService } from './UserEntityService.js';
import type { z } from 'zod';
import type { muting, user } from '@prisma/client';

@Injectable()
export class MutingEntityService {
	constructor(
		private readonly prismaService: PrismaService,
		private readonly userEntityService: UserEntityService,
	) {}

	/**
	 * `muting`をpackする。
	 *
	 * @param src
	 * @param me
	 * @returns
	 */
	@bindThis
	public async pack(
		src: muting['id'] | muting,
		me?: { id: user['id'] } | null | undefined,
	): Promise<z.infer<typeof MutingSchema>> {
		const muting = typeof src === 'object'
				? src
				: await this.prismaService.client.muting.findUniqueOrThrow({ where: { id: src } });

		return {
			id: muting.id,
			createdAt: muting.createdAt.toISOString(),
			expiresAt: muting.expiresAt?.toISOString() ?? null,
			muteeId: muting.muteeId,
			mutee: await this.userEntityService.packDetailed(muting.muteeId, me),
		};
	}
}
