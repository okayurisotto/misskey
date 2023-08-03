import { Inject, Injectable } from '@nestjs/common';
import { DI } from '@/di-symbols.js';
import type { RegistrationTicketsRepository } from '@/models/index.js';
import { awaitAll } from '@/misc/prelude/await-all.js';
import type { User } from '@/models/entities/User.js';
import type { RegistrationTicket } from '@/models/entities/RegistrationTicket.js';
import { bindThis } from '@/decorators.js';
import type { InviteCodeSchema } from '@/models/zod/InviteCodeSchema.js';
import { UserEntityService } from './UserEntityService.js';
import type { z } from 'zod';

@Injectable()
export class InviteCodeEntityService {
	constructor(
		@Inject(DI.registrationTicketsRepository)
		private registrationTicketsRepository: RegistrationTicketsRepository,

		private userEntityService: UserEntityService,
	) {}

	@bindThis
	public async pack(
		src: RegistrationTicket['id'] | RegistrationTicket,
		me?: { id: User['id'] } | null | undefined,
	): Promise<z.infer<typeof InviteCodeSchema>> {
		const target =
			typeof src === 'object'
				? src
				: await this.registrationTicketsRepository.findOneOrFail({
						where: { id: src },
						relations: ['createdBy', 'usedBy'],
				  });

		const result = await awaitAll({
			createdBy: () =>
				target.createdBy
					? this.userEntityService.pack(target.createdBy, me)
					: Promise.resolve(null),
			usedBy: () =>
				target.usedBy
					? this.userEntityService.pack(target.usedBy, me)
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
