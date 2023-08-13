import { Injectable } from '@nestjs/common';
import type {} from '@/models/entities/Blocking.js';
import type { User } from '@/models/entities/User.js';
import type { Muting } from '@/models/entities/Muting.js';
import { bindThis } from '@/decorators.js';
import type { MutingSchema } from '@/models/zod/MutingSchema.js';
import { PrismaService } from '@/core/PrismaService.js';
import { UserEntityService } from './UserEntityService.js';
import type { z } from 'zod';
import type { muting } from '@prisma/client';

@Injectable()
export class MutingEntityService {
	constructor(
		private readonly prismaService: PrismaService,
		private readonly userEntityService: UserEntityService,
	) {}

	@bindThis
	public async pack(
		src: Muting['id'] | muting,
		me?: { id: User['id'] } | null | undefined,
	): Promise<z.infer<typeof MutingSchema>> {
		const muting =
			typeof src === 'object'
				? src
				: await this.prismaService.client.muting.findUniqueOrThrow({ where: { id: src } });

		return {
			id: muting.id,
			createdAt: muting.createdAt.toISOString(),
			expiresAt: muting.expiresAt ? muting.expiresAt.toISOString() : null,
			muteeId: muting.muteeId,
			mutee: await this.userEntityService.pack(muting.muteeId, me, {
				detail: true,
			}),
		};
	}
}
