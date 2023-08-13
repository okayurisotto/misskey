import { z } from 'zod';
import { Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import { RoleEntityService } from '@/core/entities/RoleEntityService.js';
import { PrismaService } from '@/core/PrismaService.js';
import { RoleSchema } from '@/models/zod/RoleSchema.js';

const res = z.array(RoleSchema);
export const meta = {
	tags: ['admin', 'role'],
	requireCredential: true,
	requireModerator: true,
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
		private readonly roleEntityService: RoleEntityService,
		private readonly prismaService: PrismaService,
	) {
		super(meta, paramDef, async (_, me) => {
			const roles = await this.prismaService.client.role.findMany({
				orderBy: { lastUsedAt: 'desc' },
			});

			return (await Promise.all(
				roles.map((role) => this.roleEntityService.pack(role, me)),
			)) satisfies z.infer<typeof res>;
		});
	}
}
