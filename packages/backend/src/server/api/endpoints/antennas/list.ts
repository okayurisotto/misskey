import { z } from 'zod';
import { Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import { AntennaEntityService } from '@/core/entities/AntennaEntityService.js';
import { AntennaSchema } from '@/models/zod/AntennaSchema.js';
import { PrismaService } from '@/core/PrismaService.js';
import { EntityMap } from '@/misc/EntityMap.js';

const res = z.array(AntennaSchema);
export const meta = {
	tags: ['antennas', 'account'],
	requireCredential: true,
	kind: 'read:account',
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
		private readonly antennaEntityService: AntennaEntityService,
		private readonly prismaService: PrismaService,
	) {
		super(meta, paramDef, async (ps, me) => {
			const antennas = await this.prismaService.client.antenna.findMany({
				where: { userId: me.id },
			});

			const data = {
				antenna: new EntityMap('id', antennas),
			};

			return await Promise.all(
				antennas.map((antenna) =>
					this.antennaEntityService.pack(antenna.id, data),
				),
			);
		});
	}
}
