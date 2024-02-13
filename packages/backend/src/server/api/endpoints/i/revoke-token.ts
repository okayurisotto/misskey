import { z } from 'zod';
import { Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import { MisskeyIdSchema } from '@/models/zod/misc.js';
import { PrismaService } from '@/core/PrismaService.js';

export const meta = {
	requireCredential: true,
	secure: true,
} as const;

export const paramDef = z.object({
	tokenId: MisskeyIdSchema,
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
			const tokenExist =
				(await this.prismaService.client.accessToken.count({
					where: { id: ps.tokenId },
					take: 1,
				})) > 0;

			if (tokenExist) {
				await this.prismaService.client.accessToken.delete({
					where: {
						id: ps.tokenId,
						userId: me.id,
					},
				});
			}
		});
	}
}
