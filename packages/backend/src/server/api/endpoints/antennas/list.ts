import { z } from 'zod';
import { Inject, Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import type { AntennasRepository } from '@/models/index.js';
import { AntennaEntityService } from '@/core/entities/AntennaEntityService.js';
import { DI } from '@/di-symbols.js';
import { AntennaSchema } from '@/models/zod/AntennaSchema.js';

const res = z.array(AntennaSchema);
export const meta = {
	tags: ['antennas', 'account'],
	requireCredential: true,
	kind: 'read:account',
	res,
} as const;

export const paramDef = z.unknown();

@Injectable()
// eslint-disable-next-line import/no-default-export
export default class extends Endpoint<
	typeof meta,
	typeof paramDef,
	typeof res
> {
	constructor(
		@Inject(DI.antennasRepository)
		private antennasRepository: AntennasRepository,

		private antennaEntityService: AntennaEntityService,
	) {
		super(meta, paramDef, async (ps, me) => {
			const antennas = await this.antennasRepository.findBy({
				userId: me.id,
			});

			return (await Promise.all(
				antennas.map((x) => this.antennaEntityService.pack(x)),
			)) satisfies z.infer<typeof res>;
		});
	}
}
