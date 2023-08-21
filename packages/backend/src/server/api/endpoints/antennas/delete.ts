import { z } from 'zod';
import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { noSuchAntenna } from '@/server/api/errors.js';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import { GlobalEventService } from '@/core/GlobalEventService.js';
import { MisskeyIdSchema } from '@/models/zod/misc.js';
import { PrismaService } from '@/core/PrismaService.js';
import { ApiError } from '../../error.js';

export const meta = {
	tags: ['antennas'],
	requireCredential: true,
	kind: 'write:account',
	errors: {noSuchAntenna:noSuchAntenna},
} as const;

export const paramDef = z.object({ antennaId: MisskeyIdSchema });

@Injectable()
// eslint-disable-next-line import/no-default-export
export default class extends Endpoint<
	typeof meta,
	typeof paramDef,
	z.ZodType<void>
> {
	constructor(
		private readonly globalEventService: GlobalEventService,
		private readonly prismaService: PrismaService,
	) {
		super(meta, paramDef, async (ps, me) => {
			let antenna;
			try {
				antenna = await this.prismaService.client.antenna.delete({
					where: { id: ps.antennaId, userId: me.id },
				});
			} catch (e) {
				if (e instanceof Prisma.PrismaClientKnownRequestError) {
					if (e.code === 'P2025') {
						throw new ApiError(meta.errors.noSuchAntenna);
					}
				}

				throw e;
			}

			this.globalEventService.publishInternalEvent('antennaDeleted', antenna);
		});
	}
}
