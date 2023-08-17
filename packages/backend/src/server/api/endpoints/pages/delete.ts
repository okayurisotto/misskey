import { z } from 'zod';
import { Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import { MisskeyIdSchema } from '@/models/zod/misc.js';
import { PrismaService } from '@/core/PrismaService.js';
import { ApiError } from '../../error.js';

export const meta = {
	tags: ['pages'],
	requireCredential: true,
	kind: 'write:pages',
	errors: {
		noSuchPage: {
			message: 'No such page.',
			code: 'NO_SUCH_PAGE',
			id: 'eb0c6e1d-d519-4764-9486-52a7e1c6392a',
		},
		accessDenied: {
			message: 'Access denied.',
			code: 'ACCESS_DENIED',
			id: '8b741b3e-2c22-44b3-a15f-29949aa1601e',
		},
	},
} as const;

export const paramDef = z.object({
	pageId: MisskeyIdSchema,
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
			const page = await this.prismaService.client.page.findUnique({
				where: { id: ps.pageId },
			});
			if (page == null) {
				throw new ApiError(meta.errors.noSuchPage);
			}
			if (page.userId !== me.id) {
				throw new ApiError(meta.errors.accessDenied);
			}

			await this.prismaService.client.page.delete({ where: { id: page.id } });
		});
	}
}
