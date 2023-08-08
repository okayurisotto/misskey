import { z } from 'zod';
import { Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import { PrismaService } from '@/core/PrismaService.js';
import { ApiError } from '../../../error.js';

export const meta = {
	requireCredential: true,
	secure: true,
	errors: {
		noSuchKey: {
			message: 'No such key.',
			code: 'NO_SUCH_KEY',
			id: '1fac4e8a-a6cd-4e39-a4a5-3a7e11f1b019',
		},
	},
} as const;

export const paramDef = z.object({
	key: z.string(),
	scope: z
		.array(z.string().regex(/^[a-zA-Z0-9_]+$/))
		.default([])
		.optional(),
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
			const item = await this.prismaService.client.registry_item.findFirst({
				where: {
					domain: null,
					userId: me.id,
					key: ps.key,
					scope: { equals: ps.scope },
				},
			});

			if (item == null) {
				throw new ApiError(meta.errors.noSuchKey);
			}

			await this.prismaService.client.registry_item.delete({
				where: { id: item.id },
			});
		});
	}
}
