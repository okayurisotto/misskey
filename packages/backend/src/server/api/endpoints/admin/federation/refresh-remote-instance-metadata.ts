import { z } from 'zod';
import { generateSchema } from '@anatine/zod-openapi';
import { Inject, Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import type { InstancesRepository } from '@/models/index.js';
import { FetchInstanceMetadataService } from '@/core/FetchInstanceMetadataService.js';
import { UtilityService } from '@/core/UtilityService.js';
import { DI } from '@/di-symbols.js';

export const meta = {
	tags: ['admin'],

	requireCredential: true,
	requireModerator: true,
} as const;

const paramDef_ = z.object({
	host: z.string(),
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
		@Inject(DI.instancesRepository)
		private instancesRepository: InstancesRepository,

		private utilityService: UtilityService,
		private fetchInstanceMetadataService: FetchInstanceMetadataService,
	) {
		super(meta, paramDef_, async (ps, me) => {
			const instance = await this.instancesRepository.findOneBy({
				host: this.utilityService.toPuny(ps.host),
			});

			if (instance == null) {
				throw new Error('instance not found');
			}

			this.fetchInstanceMetadataService.fetchInstanceMetadata(instance, true);
		});
	}
}
