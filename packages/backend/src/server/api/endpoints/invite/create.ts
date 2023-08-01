import { z } from 'zod';
import { generateSchema } from '@anatine/zod-openapi';
import { MoreThan } from 'typeorm';
import { Inject, Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import type { RegistrationTicketsRepository } from '@/models/index.js';
import { InviteCodeEntityService } from '@/core/entities/InviteCodeEntityService.js';
import { IdService } from '@/core/IdService.js';
import { RoleService } from '@/core/RoleService.js';
import { DI } from '@/di-symbols.js';
import { generateInviteCode } from '@/misc/generate-invite-code.js';
import { ApiError } from '../../error.js';

const res = z.object({
	code: z.string(),
});
export const meta = {
	tags: ['meta'],
	requireCredential: true,
	requireRolePolicy: 'canInvite',
	errors: {
		exceededCreateLimit: {
			message: 'You have exceeded the limit for creating an invitation code.',
			code: 'EXCEEDED_LIMIT_OF_CREATE_INVITE_CODE',
			id: '8b165dd3-6f37-4557-8db1-73175d63c641',
		},
	},
	res: generateSchema(res),
} as const;

const paramDef_ = z.object({});
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
		private idService: IdService,
		private roleService: RoleService,
	) {
		super(meta, paramDef_, async (ps, me) => {
			const policies = await this.roleService.getUserPolicies(me.id);

			if (policies.inviteLimit) {
				const count = await this.registrationTicketsRepository.countBy({
					createdAt: MoreThan(
						new Date(Date.now() - policies.inviteLimitCycle * 1000 * 60),
					),
					createdById: me.id,
				});

				if (count >= policies.inviteLimit) {
					throw new ApiError(meta.errors.exceededCreateLimit);
				}
			}

			const ticket = await this.registrationTicketsRepository
				.insert({
					id: this.idService.genId(),
					createdAt: new Date(),
					createdBy: me,
					createdById: me.id,
					expiresAt: policies.inviteExpirationTime
						? new Date(Date.now() + policies.inviteExpirationTime * 1000 * 60)
						: null,
					code: generateInviteCode(),
				})
				.then((x) =>
					this.registrationTicketsRepository.findOneByOrFail(x.identifiers[0]),
				);

			return (await this.inviteCodeEntityService.pack(
				ticket,
				me,
			)) satisfies z.infer<typeof res>;
		});
	}
}
