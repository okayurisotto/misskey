import { Injectable } from '@nestjs/common';
import z from 'zod';
import { generateSchema } from '@anatine/zod-openapi';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import { MetaService } from '@/core/MetaService.js';
import { DriveFileEntityService } from '@/core/entities/DriveFileEntityService.js';
import { RoleService } from '@/core/RoleService.js';

const res = z.object({
	capacity: z.number(),
	usage: z.number(),
});
export const meta = {
	tags: ['drive', 'account'],
	requireCredential: true,
	kind: 'read:drive',
	res: generateSchema(res),
} as const;

const paramDef_ = z.unknown();
export const paramDef = generateSchema(paramDef_);

@Injectable()
// eslint-disable-next-line import/no-default-export
export default class extends Endpoint<
	typeof meta,
	typeof paramDef_,
	typeof res
> {
	constructor(
		private metaService: MetaService,
		private driveFileEntityService: DriveFileEntityService,
		private roleService: RoleService,
	) {
		super(meta, paramDef_, async (ps, me) => {
			const instance = await this.metaService.fetch(true);

			// Calculate drive usage
			const usage = await this.driveFileEntityService.calcDriveUsageOf(me.id);

			const policies = await this.roleService.getUserPolicies(me.id);

			return {
				capacity: 1024 * 1024 * policies.driveCapacityMb,
				usage: usage,
			} satisfies z.infer<typeof res>;
		});
	}
}
