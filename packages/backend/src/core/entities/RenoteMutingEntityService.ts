import { Injectable } from '@nestjs/common';
import type { User } from '@/models/entities/User.js';
import type { RenoteMuting } from '@/models/entities/RenoteMuting.js';
import { bindThis } from '@/decorators.js';
import type { RenoteMutingSchema } from '@/models/zod/RenoteMutingSchema.js';
import { PrismaService } from '@/core/PrismaService.js';
import { UserEntityService } from './UserEntityService.js';
import type { z } from 'zod';
import type { renote_muting } from '@prisma/client';

@Injectable()
export class RenoteMutingEntityService {
	constructor(
		private readonly prismaService: PrismaService,
		private readonly userEntityService: UserEntityService,
	) {}

	@bindThis
	public async pack(
		src: RenoteMuting['id'] | renote_muting,
		me?: { id: User['id'] } | null | undefined,
	): Promise<z.infer<typeof RenoteMutingSchema>> {
		const muting =
			typeof src === 'object'
				? src
				: await this.prismaService.client.renote_muting.findUniqueOrThrow({ where: { id: src } });

		return {
			id: muting.id,
			createdAt: muting.createdAt.toISOString(),
			muteeId: muting.muteeId,
			mutee: await this.userEntityService.pack(muting.muteeId, me, {
				detail: true,
			}),
		};
	}
}
