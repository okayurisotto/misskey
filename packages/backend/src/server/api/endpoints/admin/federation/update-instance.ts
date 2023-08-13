import { z } from 'zod';
import { Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import { UtilityService } from '@/core/UtilityService.js';
import { FederatedInstanceService } from '@/core/FederatedInstanceService.js';
import { PrismaService } from '@/core/PrismaService.js';

export const meta = {
	tags: ['admin'],
	requireCredential: true,
	requireModerator: true,
} as const;

export const paramDef = z.object({
	host: z.string(),
	isSuspended: z.boolean(),
});

@Injectable()
// eslint-disable-next-line import/no-default-export
export default class extends Endpoint<
	typeof meta,
	typeof paramDef,
	z.ZodType<void>
> {
	constructor(
		private readonly utilityService: UtilityService,
		private readonly federatedInstanceService: FederatedInstanceService,
		private readonly prismaService: PrismaService,
	) {
		super(meta, paramDef, async (ps) => {
			const instance = await this.prismaService.client.instance.findUnique({
				where: { host: this.utilityService.toPuny(ps.host) },
			});

			if (instance === null) {
				throw new Error('instance not found');
			}

			await this.federatedInstanceService.update(instance.id, {
				isSuspended: ps.isSuspended,
			});
		});
	}
}
