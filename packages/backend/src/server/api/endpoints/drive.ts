import { Injectable } from '@nestjs/common';
import z from 'zod';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import { MetaService } from '@/core/MetaService.js';
import { DriveFileEntityService } from '@/core/entities/DriveFileEntityService.js';
import { RoleService } from '@/core/RoleService.js';
import { awaitAll } from '@/misc/prelude/await-all.js';

const res = z.object({
	capacity: z.number(),
	usage: z.number(),
});
export const meta = {
	tags: ['drive', 'account'],
	requireCredential: true,
	kind: 'read:drive',
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
		private metaService: MetaService,
		private driveFileEntityService: DriveFileEntityService,
		private roleService: RoleService,
	) {
		super(meta, paramDef, async (ps, me) => {
			const { policies, usage } = await awaitAll({
				policies: () => this.roleService.getUserPolicies(me.id),
				usage: () => this.driveFileEntityService.calcDriveUsageOf(me.id),
			});

			return {
				capacity: 1024 * 1024 * policies.driveCapacityMb,
				usage: usage,
			};
		});
	}
}
