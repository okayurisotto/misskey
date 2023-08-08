import { z } from 'zod';
import { Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import { MisskeyIdSchema } from '@/models/zod/misc.js';
import { PrismaService } from '@/core/PrismaService.js';
import { ApiError } from '../../../error.js';

export const meta = {
	tags: ['admin'],
	requireCredential: true,
	requireModerator: true,
	errors: {
		noSuchAd: {
			message: 'No such ad.',
			code: 'NO_SUCH_AD',
			id: 'ccac9863-3a03-416e-b899-8a64041118b1',
		},
	},
} as const;

export const paramDef = z.object({ id: MisskeyIdSchema });

@Injectable()
// eslint-disable-next-line import/no-default-export
export default class extends Endpoint<
	typeof meta,
	typeof paramDef,
	z.ZodType<void>
> {
	constructor(private readonly prismaService: PrismaService) {
		super(meta, paramDef, async (ps) => {
			const ad = await this.prismaService.client.ad.findUnique({
				where: { id: ps.id },
			});
			if (ad === null) throw new ApiError(meta.errors.noSuchAd);

			await this.prismaService.client.ad.delete({ where: { id: ad.id } });
		});
	}
}
