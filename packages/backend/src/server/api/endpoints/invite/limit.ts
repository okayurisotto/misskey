import { z } from 'zod';
import { Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import { RoleService } from '@/core/RoleService.js';
import { PrismaService } from '@/core/PrismaService.js';

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
		private readonly roleService: RoleService,
		private readonly prismaService: PrismaService,
	) {
		super(meta, paramDef, async (ps, me) => {
			const policies = await this.roleService.getUserPolicies(me.id);

			const count = policies.inviteLimit
				? await this.prismaService.client.inviteCode.count({
						where: {
							createdAt: {
								gt: new Date(
									Date.now() - policies.inviteExpirationTime * 60 * 1000,
								),
							},
							createdById: me.id,
						},
				  })
				: null;

			return {
				remaining:
					count !== null ? Math.max(0, policies.inviteLimit - count) : null,
			};
		});
	}
}
