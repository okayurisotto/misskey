import { noSuchFlash____, accessDenied_______ } from '@/server/api/errors.js';
import { z } from 'zod';
import ms from 'ms';
import { Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import { MisskeyIdSchema } from '@/models/zod/misc.js';
import { PrismaService } from '@/core/PrismaService.js';
import { ApiError } from '../../error.js';

export const meta = {
	tags: ['flash'],
	requireCredential: true,
	prohibitMoved: true,
	kind: 'write:flash',
	limit: {
		duration: ms('1hour'),
		max: 300,
	},
	errors: {noSuchFlash:noSuchFlash____,accessDenied:accessDenied_______},
} as const;

export const paramDef = z.object({
	flashId: MisskeyIdSchema,
	title: z.string(),
	summary: z.string(),
	script: z.string(),
	permissions: z.array(z.string()),
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

			await this.prismaService.client.flash.update({
				where: { id: flash.id },
				data: {
					updatedAt: new Date(),
					title: ps.title,
					summary: ps.summary,
					script: ps.script,
					permissions: ps.permissions,
				},
			});
		});
	}
}
