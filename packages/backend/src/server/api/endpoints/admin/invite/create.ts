import { z } from 'zod';
import { Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import { InviteCodeEntityService } from '@/core/entities/InviteCodeEntityService.js';
import { IdService } from '@/core/IdService.js';
import { generateInviteCode } from '@/misc/generate-invite-code.js';
import { PrismaService } from '@/core/PrismaService.js';
import { ApiError } from '../../../error.js';
import { limit } from '@/models/zod/misc.js';

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
	count: limit({ max: 100, default: 1 }),
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
		private readonly inviteCodeEntityService: InviteCodeEntityService,
		private readonly idService: IdService,
		private readonly prismaService: PrismaService,
	) {
		super(meta, paramDef, async (ps, me) => {
			if (ps.expiresAt && Number.isNaN(Date.parse(ps.expiresAt))) {
				throw new ApiError(meta.errors.invalidDateTime);
			}

			const ticketdata = Array.from({ length: ps.count }).map(() => ({
				id: this.idService.genId(),
				createdAt: new Date(),
				expiresAt: ps.expiresAt ? new Date(ps.expiresAt) : null,
				code: generateInviteCode(),
			}));
			await this.prismaService.client.registration_ticket.createMany({
				data: ticketdata,
			});

			// https://github.com/prisma/prisma/issues/8131
			const tickets =
				await this.prismaService.client.registration_ticket.findMany({
					where: { id: { in: ticketdata.map((ticket) => ticket.id) } },
				});

			return (await Promise.all(
				tickets.map((ticket) => this.inviteCodeEntityService.pack(ticket, me)),
			)) satisfies z.infer<typeof res>;
		});
	}
}
