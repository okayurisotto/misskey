import { z } from 'zod';
import { Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import { AntennaEntityService } from '@/core/entities/AntennaEntityService.js';
import { AntennaSchema } from '@/models/zod/AntennaSchema.js';
import { MisskeyIdSchema } from '@/models/zod/misc.js';
import { PrismaService } from '@/core/PrismaService.js';
import { ApiError } from '../../error.js';

const res = AntennaSchema;
export const meta = {
	tags: ['antennas', 'account'],
	requireCredential: true,
	kind: 'read:account',
	errors: {
		noSuchAntenna: {
			message: 'No such antenna.',
			code: 'NO_SUCH_ANTENNA',
			id: 'c06569fb-b025-4f23-b22d-1fcd20d2816b',
		},
	},
	res,
} as const;

export const paramDef = z.object({
	antennaId: MisskeyIdSchema,
});

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
			// Fetch the antenna
			const antenna = await this.prismaService.client.antenna.findUnique({
				where: {
					id: ps.antennaId,
					userId: me.id,
				},
			});

			if (antenna == null) {
				throw new ApiError(meta.errors.noSuchAntenna);
			}

			return await this.antennaEntityService.pack(antenna);
		});
	}
}
