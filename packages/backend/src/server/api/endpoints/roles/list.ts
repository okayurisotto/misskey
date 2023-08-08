import { z } from 'zod';
import { Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import { RoleEntityService } from '@/core/entities/RoleEntityService.js';
import { PrismaService } from '@/core/PrismaService.js';

const res = z.unknown();
export const meta = {
	tags: ['role'],
	requireCredential: true,
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
		super(meta, paramDef, async (ps, me) => {
			const roles = await this.prismaService.client.role.findMany({
				where: {
					isPublic: true,
					isExplorable: true,
				},
			});
			return (await Promise.all(
				roles.map((role) => this.roleEntityService.pack(role, me)),
			)) satisfies z.infer<typeof res>;
		});
	}
}
