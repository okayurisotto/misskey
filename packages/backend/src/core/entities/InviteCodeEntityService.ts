import { Injectable } from '@nestjs/common';
import { awaitAll } from '@/misc/prelude/await-all.js';
import type { User } from '@/models/entities/User.js';
import type { RegistrationTicket } from '@/models/entities/RegistrationTicket.js';
import { bindThis } from '@/decorators.js';
import type { InviteCodeSchema } from '@/models/zod/InviteCodeSchema.js';
import type { T2P } from '@/types.js';
import { PrismaService } from '@/core/PrismaService.js';
import { UserEntityService } from './UserEntityService.js';
import type { z } from 'zod';
import type { registration_ticket } from '@prisma/client';

@Injectable()
export class InviteCodeEntityService {
	constructor(
		private readonly prismaService: PrismaService,
		private readonly userEntityService: UserEntityService,
	) {}

	@bindThis
	public async pack(
		src:
			| RegistrationTicket['id']
			| T2P<RegistrationTicket, registration_ticket>,
		me?: { id: User['id'] } | null | undefined,
	): Promise<z.infer<typeof InviteCodeSchema>> {
		const target =
			typeof src === 'object'
				? src
				: await this.prismaService.client.registration_ticket.findUniqueOrThrow({ where: { id: src } });

		const result = await awaitAll({
			createdBy: () =>
				target.createdById
					? this.userEntityService.pack(target.createdById, me)
					: Promise.resolve(null),
			usedBy: () =>
				target.usedById
					? this.userEntityService.pack(target.usedById, me)
					: Promise.resolve(null),
		});

		return {
			id: target.id,
			code: target.code,
			expiresAt: target.expiresAt ? target.expiresAt.toISOString() : null,
			createdAt: target.createdAt.toISOString(),
			createdBy: result.createdBy,
			usedBy: result.usedBy,
			usedAt: target.usedAt ? target.usedAt.toISOString() : null,
			used: !!target.usedAt,
		};
	}
}
