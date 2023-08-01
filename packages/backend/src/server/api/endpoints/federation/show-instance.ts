import { z } from 'zod';
import { Inject, Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import type { InstancesRepository } from '@/models/index.js';
import { InstanceEntityService } from '@/core/entities/InstanceEntityService.js';
import { UtilityService } from '@/core/UtilityService.js';
import { DI } from '@/di-symbols.js';
import { FederationInstanceSchema } from '@/models/zod/FederationInstanceSchema.js';

const res = FederationInstanceSchema;
export const meta = {
	tags: ['federation'],
	requireCredential: false,
	res,
} as const;

export const paramDef = z.object({
	host: z.string(),
});

@Injectable()
// eslint-disable-next-line import/no-default-export
export default class extends Endpoint<
	typeof meta,
	typeof paramDef,
	typeof res
> {
	constructor(
		@Inject(DI.instancesRepository)
		private instancesRepository: InstancesRepository,

		private utilityService: UtilityService,
		private instanceEntityService: InstanceEntityService,
	) {
		super(meta, paramDef, async (ps, me) => {
			const instance = await this.instancesRepository.findOneBy({
				host: this.utilityService.toPuny(ps.host),
			});

			return instance
				? await this.instanceEntityService.pack(instance)
				: (null satisfies z.infer<typeof res>);
		});
	}
}
