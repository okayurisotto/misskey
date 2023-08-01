import { z } from 'zod';
import { generateSchema } from '@anatine/zod-openapi';
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
		@Inject(DI.antennasRepository)
		private antennasRepository: AntennasRepository,

		private antennaEntityService: AntennaEntityService,
	) {
		super(meta, paramDef_, async (ps, me) => {
			const antennas = await this.antennasRepository.findBy({
				userId: me.id,
			});

			return (await Promise.all(
				antennas.map((x) => this.antennaEntityService.pack(x)),
			)) satisfies z.infer<typeof res>;
		});
	}
}
