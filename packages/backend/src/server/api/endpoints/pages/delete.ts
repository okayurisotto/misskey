import { z } from 'zod';
import { Injectable } from '@nestjs/common';
import { noSuchPage__, accessDenied___________ } from '@/server/api/errors.js';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import { MisskeyIdSchema } from '@/models/zod/misc.js';
import { PrismaService } from '@/core/PrismaService.js';
import { ApiError } from '../../error.js';

export const meta = {
	tags: ['pages'],
	requireCredential: true,
	kind: 'write:pages',
	errors: {noSuchPage:noSuchPage__,accessDenied:accessDenied___________},
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
