import { z } from 'zod';
import { Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import { GlobalEventService } from '@/core/GlobalEventService.js';
import { MetaService } from '@/core/MetaService.js';
import { RolePoliciesSchema } from '@/models/zod/RolePoliciesSchema.js';

export const meta = {
	tags: ['admin', 'role'],
	requireCredential: true,
	requireAdmin: true,
} as const;

export const paramDef = z.object({
	policies: RolePoliciesSchema,
});

@Injectable()
// eslint-disable-next-line import/no-default-export
export default class extends Endpoint<
	typeof meta,
	typeof paramDef,
	z.ZodType<void>
> {
	constructor(
		private readonly metaService: MetaService,
		private readonly globalEventService: GlobalEventService,
	) {
		super(meta, paramDef, async (ps) => {
			await this.metaService.update({
				policies: ps.policies,
			});
			this.globalEventService.publishInternalEvent(
				'policiesUpdated',
				ps.policies,
			);
		});
	}
}
