import { z } from 'zod';
import { Inject, Injectable } from '@nestjs/common';
import { MoreThan } from 'typeorm';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import type { RegistrationTicketsRepository } from '@/models/index.js';
import { RoleService } from '@/core/RoleService.js';
import { DI } from '@/di-symbols.js';

const res = z.object({
	remaining: z.number().int().nullable(),
});
export const meta = {
	tags: ['meta'],
	requireCredential: true,
	requireRolePolicy: 'canInvite',
	res,
} as const;

export const paramDef = z.object({});

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

		private roleService: RoleService,
	) {
		super(meta, paramDef, async (ps, me) => {
			const policies = await this.roleService.getUserPolicies(me.id);

			const count = policies.inviteLimit
				? await this.registrationTicketsRepository.countBy({
						createdAt: MoreThan(
							new Date(Date.now() - policies.inviteExpirationTime * 60 * 1000),
						),
						createdById: me.id,
				  })
				: null;

			return {
				remaining:
					count !== null ? Math.max(0, policies.inviteLimit - count) : null,
			} satisfies z.infer<typeof res>;
		});
	}
}
