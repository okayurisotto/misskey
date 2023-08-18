import { Injectable } from '@nestjs/common';
import { awaitAll } from '@/misc/prelude/await-all.js';
import { bindThis } from '@/decorators.js';
import type { InviteCodeSchema } from '@/models/zod/InviteCodeSchema.js';
import { PrismaService } from '@/core/PrismaService.js';
import { UserEntityService } from './UserEntityService.js';
import type { z } from 'zod';
import type { registration_ticket, user } from '@prisma/client';

@Injectable()
export class InviteCodeEntityService {
	constructor(
		private readonly prismaService: PrismaService,
		private readonly userEntityService: UserEntityService,
	) {}

	/**
	 * `registration_ticket`をpackする。
	 *
	 * @param src
	 * @param me
	 * @returns
	 */
	@bindThis
	public async pack(
		src: registration_ticket['id'] | registration_ticket,
		me?: { id: user['id'] } | null | undefined,
	): Promise<z.infer<typeof InviteCodeSchema>> {
		const target = typeof src === 'object'
			? src
			: await this.prismaService.client.registration_ticket.findUniqueOrThrow({ where: { id: src } });

		const result = await awaitAll({
			createdBy: () =>
				target.createdById
					? this.userEntityService.packLite(target.createdById)
					: Promise.resolve(null),
			usedBy: () =>
				target.usedById
					? this.userEntityService.packLite(target.usedById)
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
