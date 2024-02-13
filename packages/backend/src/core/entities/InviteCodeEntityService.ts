import { Injectable } from '@nestjs/common';
import { awaitAll } from '@/misc/prelude/await-all.js';
import type { InviteCodeSchema } from '@/models/zod/InviteCodeSchema.js';
import { PrismaService } from '@/core/PrismaService.js';
import { UserEntityPackLiteService } from './UserEntityPackLiteService.js';
import type { z } from 'zod';
import type { InviteCode, user } from '@prisma/client';

@Injectable()
export class InviteCodeEntityService {
	constructor(
		private readonly prismaService: PrismaService,
		private readonly userEntityPackLiteService: UserEntityPackLiteService,
	) {}

	/**
	 * `InviteCode`をpackする。
	 *
	 * @param src
	 * @param me
	 * @returns
	 */
	public async pack(
		src: InviteCode['id'] | InviteCode,
		me?: { id: user['id'] } | null | undefined,
	): Promise<z.infer<typeof InviteCodeSchema>> {
		const target = await this.prismaService.client.inviteCode.findUniqueOrThrow(
			{
				where: { id: typeof src === 'string' ? src : src.id },
				include: { createdBy: true, usedBy: true },
			},
		);

		const result = await awaitAll({
			createdBy: () =>
				target.createdBy
					? this.userEntityPackLiteService.packLite(target.createdBy)
					: Promise.resolve(null),
			usedBy: () =>
				target.usedBy
					? this.userEntityPackLiteService.packLite(target.usedBy)
					: Promise.resolve(null),
		});

		return {
			id: target.id,
			code: target.code,
			expiresAt: target.expiresAt?.toISOString() ?? null,
			createdAt: target.createdAt.toISOString(),
			createdBy: result.createdBy,
			usedBy: result.usedBy,
			usedAt: target.usedAt ? target.usedAt.toISOString() : null,
			used: target.usedAt !== null,
		};
	}
}
