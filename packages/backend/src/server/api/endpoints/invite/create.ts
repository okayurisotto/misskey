import { z } from 'zod';
import { Injectable } from '@nestjs/common';
import { exceededCreateLimit } from '@/server/api/errors.js';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import { InviteCodeEntityService } from '@/core/entities/InviteCodeEntityService.js';
import { IdService } from '@/core/IdService.js';
import { RoleService } from '@/core/RoleService.js';
import { generateInviteCode } from '@/misc/generate-invite-code.js';
import { PrismaService } from '@/core/PrismaService.js';
import { ApiError } from '../../error.js';

const res = z.object({
	code: z.string(),
});
export const meta = {
	tags: ['meta'],
	requireCredential: true,
	requireRolePolicy: 'canInvite',
	errors: { exceededCreateLimit: exceededCreateLimit },
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
		private readonly inviteCodeEntityService: InviteCodeEntityService,
		private readonly idService: IdService,
		private readonly roleService: RoleService,
		private readonly prismaService: PrismaService,
	) {
		super(meta, paramDef, async (ps, me) => {
			const policies = await this.roleService.getUserPolicies(me.id);

			if (policies.inviteLimit) {
				const count = await this.prismaService.client.inviteCode.count(
					{
						where: {
							createdAt: {
								gt: new Date(
									Date.now() - policies.inviteLimitCycle * 1000 * 60,
								),
							},
							createdById: me.id,
						},
					},
				);

				if (count >= policies.inviteLimit) {
					throw new ApiError(meta.errors.exceededCreateLimit);
				}
			}

			const ticket = await this.prismaService.client.inviteCode.create(
				{
					data: {
						id: this.idService.genId(),
						createdAt: new Date(),
						createdById: me.id,
						expiresAt: policies.inviteExpirationTime
							? new Date(Date.now() + policies.inviteExpirationTime * 1000 * 60)
							: null,
						code: generateInviteCode(),
					},
				},
			);

			return await this.inviteCodeEntityService.pack(ticket, me);
		});
	}
}
