import { z } from 'zod';
import { Injectable } from '@nestjs/common';
import { noSuchFlash, accessDenied______ } from '@/server/api/errors.js';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import { MisskeyIdSchema } from '@/models/zod/misc.js';
import { PrismaService } from '@/core/PrismaService.js';
import { ApiError } from '../../error.js';

export const meta = {
	tags: ['flashs'],
	requireCredential: true,
	kind: 'write:flash',
	errors: {noSuchFlash:noSuchFlash,accessDenied:accessDenied______},
} as const;

export const paramDef = z.object({
	flashId: MisskeyIdSchema,
});

@Injectable()
// eslint-disable-next-line import/no-default-export
export default class extends Endpoint<
	typeof meta,
	typeof paramDef,
	z.ZodType<void>
> {
	constructor(private readonly prismaService: PrismaService) {
		super(meta, paramDef, async (ps, me) => {
			const flash = await this.prismaService.client.flash.findUnique({
				where: { id: ps.flashId },
			});
			if (flash == null) {
				throw new ApiError(meta.errors.noSuchFlash);
			}
			if (flash.userId !== me.id) {
				throw new ApiError(meta.errors.accessDenied);
			}

			await this.prismaService.client.flash.delete({ where: { id: flash.id } });
		});
	}
}
