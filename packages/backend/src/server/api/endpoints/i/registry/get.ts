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
			id: 'ac3ed68a-62f0-422b-a7bc-d5e09e8f6a6a',
		},
	},
} as const;

export const paramDef = z.object({
	key: z.string(),
	scope: z.array(z.string().regex(/^[a-zA-Z0-9_]+$/)).default([]),
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

			return z.any().parse(item.value);
		});
	}
}
