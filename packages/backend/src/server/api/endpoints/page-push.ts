import { z } from 'zod';
import { Injectable } from '@nestjs/common';
import { noSuchPage_ } from '@/server/api/errors.js';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import { UserEntityService } from '@/core/entities/UserEntityService.js';
import { GlobalEventService } from '@/core/GlobalEventService.js';
import { MisskeyIdSchema } from '@/models/zod/misc.js';
import { PrismaService } from '@/core/PrismaService.js';
import { ApiError } from '../error.js';

export const meta = {
	requireCredential: true,
	secure: true,
	errors: { noSuchPage: noSuchPage_ },
} as const;

export const paramDef = z.object({
	pageId: MisskeyIdSchema,
	event: z.string(),
	var: z.unknown().optional(),
});

@Injectable()
// eslint-disable-next-line import/no-default-export
export default class extends Endpoint<
	typeof meta,
	typeof paramDef,
	z.ZodType<void>
> {
	constructor(
		private readonly userEntityService: UserEntityService,
		private readonly globalEventService: GlobalEventService,
		private readonly prismaService: PrismaService,
	) {
		super(meta, paramDef, async (ps, me) => {
			const page = await this.prismaService.client.page.findUnique({
				where: { id: ps.pageId },
			});
			if (page == null) {
				throw new ApiError(meta.errors.noSuchPage);
			}

			this.globalEventService.publishMainStream(page.userId, 'pageEvent', {
				pageId: ps.pageId,
				event: ps.event,
				var: ps.var,
				userId: me.id,
				user: await this.userEntityService.packDetailed(me.id, {
					id: page.userId,
				}),
			});
		});
	}
}
