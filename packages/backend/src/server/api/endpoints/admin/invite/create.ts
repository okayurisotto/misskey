import { z } from 'zod';
import { Inject, Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import type { RegistrationTicketsRepository } from '@/models/index.js';
import { InviteCodeEntityService } from '@/core/entities/InviteCodeEntityService.js';
import { IdService } from '@/core/IdService.js';
import { DI } from '@/di-symbols.js';
import { generateInviteCode } from '@/misc/generate-invite-code.js';
import { ApiError } from '../../../error.js';

const res = z.array(z.object({ code: z.string() }));
export const meta = {
	tags: ['admin'],
	requireCredential: true,
	requireModerator: true,
	errors: {
		invalidDateTime: {
			message: 'Invalid date-time format',
			code: 'INVALID_DATE_TIME',
			id: 'f1380b15-3760-4c6c-a1db-5c3aaf1cbd49',
		},
	},
	res,
} as const;

export const paramDef = z.object({
	count: z.number().int().min(1).max(100).default(1),
	expiresAt: z.string().nullable().optional(),
});

@Injectable()
// eslint-disable-next-line import/no-default-export
export default class extends Endpoint<
	typeof meta,
	typeof paramDef,
	typeof res
> {
	constructor(
		@Inject(DI.registrationTicketsRepository)
		private registrationTicketsRepository: RegistrationTicketsRepository,

		private inviteCodeEntityService: InviteCodeEntityService,
		private idService: IdService,
	) {
		super(meta, paramDef, async (ps, me) => {
			if (ps.expiresAt && isNaN(Date.parse(ps.expiresAt))) {
				throw new ApiError(meta.errors.invalidDateTime);
			}

			const ticketsPromises = [];

			for (let i = 0; i < ps.count; i++) {
				ticketsPromises.push(
					this.registrationTicketsRepository
						.insert({
							id: this.idService.genId(),
							createdAt: new Date(),
							expiresAt: ps.expiresAt ? new Date(ps.expiresAt) : null,
							code: generateInviteCode(),
						})
						.then((x) =>
							this.registrationTicketsRepository.findOneByOrFail(
								x.identifiers[0],
							),
						),
				);
			}

			const tickets = await Promise.all(ticketsPromises);
			return (await Promise.all(
				tickets.map((ticket) => this.inviteCodeEntityService.pack(ticket, me)),
			)) satisfies z.infer<typeof res>;
		});
	}
}
