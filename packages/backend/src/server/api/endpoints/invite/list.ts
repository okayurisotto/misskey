import { z } from 'zod';
import { generateSchema } from '@anatine/zod-openapi';
import { Inject, Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import type { RegistrationTicketsRepository } from '@/models/index.js';
import { InviteCodeEntityService } from '@/core/entities/InviteCodeEntityService.js';
import { QueryService } from '@/core/QueryService.js';
import { DI } from '@/di-symbols.js';
import { misskeyIdPattern } from '@/models/zod/misc.js';
import { ApiError } from '../../error.js';

const res = z.array(z.unknown());
export const meta = {
	tags: ['meta'],
	requireCredential: true,
	requireRolePolicy: 'canInvite',
	res: generateSchema(res),
} as const;

const paramDef_ = z.object({
	limit: z.number().int().min(1).max(100).default(30),
	sinceId: misskeyIdPattern.optional(),
	untilId: misskeyIdPattern.optional(),
});
export const paramDef = generateSchema(paramDef_);

@Injectable()
// eslint-disable-next-line import/no-default-export
export default class extends Endpoint<
	typeof meta,
	typeof paramDef_,
	typeof res
> {
	constructor(
		@Inject(DI.registrationTicketsRepository)
		private registrationTicketsRepository: RegistrationTicketsRepository,

		private inviteCodeEntityService: InviteCodeEntityService,
		private queryService: QueryService,
	) {
		super(meta, paramDef_, async (ps, me) => {
			const query = this.queryService
				.makePaginationQuery(
					this.registrationTicketsRepository.createQueryBuilder('ticket'),
					ps.sinceId,
					ps.untilId,
				)
				.andWhere('ticket.createdById = :meId', { meId: me.id })
				.leftJoinAndSelect('ticket.createdBy', 'createdBy')
				.leftJoinAndSelect('ticket.usedBy', 'usedBy');

			const tickets = await query.limit(ps.limit).getMany();

			return (await this.inviteCodeEntityService.packMany(
				tickets,
				me,
			)) satisfies z.infer<typeof res>;
		});
	}
}
