import { z } from 'zod';
import { generateSchema } from '@anatine/zod-openapi';
import { Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import { GlobalEventService } from '@/core/GlobalEventService.js';
import { MetaService } from '@/core/MetaService.js';

export const meta = {
	tags: ['admin', 'role'],
	requireCredential: true,
	requireAdmin: true,
} as const;

const paramDef_ = z.object({
	policies: z.unknown(),
});
export const paramDef = generateSchema(paramDef_);

@Injectable()
// eslint-disable-next-line import/no-default-export
export default class extends Endpoint<
	typeof meta,
	typeof paramDef_,
	z.ZodType<void>
> {
	constructor(
		private metaService: MetaService,
		private globalEventService: GlobalEventService,
	) {
		super(meta, paramDef_, async (ps) => {
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
