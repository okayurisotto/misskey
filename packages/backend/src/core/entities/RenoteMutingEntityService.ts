import { Injectable } from '@nestjs/common';
import type { RenoteMutingSchema } from '@/models/zod/RenoteMutingSchema.js';
import { PrismaService } from '@/core/PrismaService.js';
import { UserEntityService } from './UserEntityService.js';
import type { z } from 'zod';
import type { RenoteMuting, user } from '@prisma/client';

@Injectable()
export class RenoteMutingEntityService {
	constructor(
		private readonly prismaService: PrismaService,
		private readonly userEntityService: UserEntityService,
	) {}

	/**
	 * `renote_muting`をpackする。
	 *
	 * @param src
	 * @param me
	 * @returns
	 */
	public async pack(
		src: RenoteMuting['id'] | RenoteMuting,
		me?: { id: user['id'] } | null | undefined,
	): Promise<z.infer<typeof RenoteMutingSchema>> {
		const muting =
			typeof src === 'object'
				? src
				: await this.prismaService.client.renoteMuting.findUniqueOrThrow({
						where: { id: src },
				  });

		return {
			id: muting.id,
			createdAt: muting.createdAt.toISOString(),
			muteeId: muting.muteeId,
			mutee: await this.userEntityService.packDetailed(muting.muteeId, me),
		};
	}
}
