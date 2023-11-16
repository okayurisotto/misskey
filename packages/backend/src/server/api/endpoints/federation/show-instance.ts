import { z } from 'zod';
import { Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import { InstanceEntityService } from '@/core/entities/InstanceEntityService.js';
import { UtilityService } from '@/core/UtilityService.js';
import { FederationInstanceSchema } from '@/models/zod/FederationInstanceSchema.js';
import { PrismaService } from '@/core/PrismaService.js';

const res = FederationInstanceSchema.nullable();
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
		private readonly utilityService: UtilityService,
		private readonly instanceEntityService: InstanceEntityService,
		private readonly prismaService: PrismaService,
	) {
		super(meta, paramDef, async (ps) => {
			const instance = await this.prismaService.client.instance.findUnique({
				where: { host: this.utilityService.toPuny(ps.host) },
			});

			return instance ? await this.instanceEntityService.pack(instance) : null;
		});
	}
}
