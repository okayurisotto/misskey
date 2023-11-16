import { Injectable } from '@nestjs/common';
import { awaitAll } from '@/misc/prelude/await-all.js';
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
	public async pack(
		src: registration_ticket['id'] | registration_ticket,
		me?: { id: user['id'] } | null | undefined,
	): Promise<z.infer<typeof InviteCodeSchema>> {
		const target = await this.prismaService.client.registration_ticket.findUniqueOrThrow({
			where: { id: typeof src === 'string' ? src : src.id },
			include: { user_registration_ticket_createdByIdTouser: true, user_registration_ticket_usedByIdTouser: true },
		});

		const result = await awaitAll({
			createdBy: () =>
				target.user_registration_ticket_createdByIdTouser
					? this.userEntityService.packLite(target.user_registration_ticket_createdByIdTouser)
					: Promise.resolve(null),
			usedBy: () =>
				target.user_registration_ticket_usedByIdTouser
					? this.userEntityService.packLite(target.user_registration_ticket_usedByIdTouser)
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
