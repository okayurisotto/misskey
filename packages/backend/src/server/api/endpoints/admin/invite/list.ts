import { z } from 'zod';
import { Inject, Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import type { RegistrationTicketsRepository } from '@/models/index.js';
import { InviteCodeEntityService } from '@/core/entities/InviteCodeEntityService.js';
import { DI } from '@/di-symbols.js';

const res = z.array(z.unknown());
export const meta = {
	tags: ['admin'],
	requireCredential: true,
	requireModerator: true,
	res,
} as const;

export const paramDef = z.object({
	limit: z.number().int().min(1).max(100).default(30),
	offset: z.number().int().default(0),
	type: z.enum(['unused', 'used', 'expired', 'all']).default('all'),
	sort: z.enum(['+createdAt', '-createdAt', '+usedAt', '-usedAt']).optional(),
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
	) {
		super(meta, paramDef, async (ps, me) => {
			const query = this.registrationTicketsRepository
				.createQueryBuilder('ticket')
				.leftJoinAndSelect('ticket.createdBy', 'createdBy')
				.leftJoinAndSelect('ticket.usedBy', 'usedBy');

			switch (ps.type) {
				case 'unused':
					query.andWhere('ticket.usedBy IS NULL');
					break;
				case 'used':
					query.andWhere('ticket.usedBy IS NOT NULL');
					break;
				case 'expired':
					query.andWhere('ticket.expiresAt < :now', { now: new Date() });
					break;
			}

			switch (ps.sort) {
				case '+createdAt':
					query.orderBy('ticket.createdAt', 'DESC');
					break;
				case '-createdAt':
					query.orderBy('ticket.createdAt', 'ASC');
					break;
				case '+usedAt':
					query.orderBy('ticket.usedAt', 'DESC', 'NULLS LAST');
					break;
				case '-usedAt':
					query.orderBy('ticket.usedAt', 'ASC', 'NULLS FIRST');
					break;
				default:
					query.orderBy('ticket.id', 'DESC');
					break;
			}

			query.limit(ps.limit);
			query.offset(ps.offset);

			const tickets = await query.getMany();

			return (await Promise.all(
				tickets.map((ticket) => this.inviteCodeEntityService.pack(ticket)),
			)) satisfies z.infer<typeof res>;
		});
	}
}
