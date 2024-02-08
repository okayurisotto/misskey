import { z } from 'zod';
import { Injectable } from '@nestjs/common';
import { IdService } from '@/core/IdService.js';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import { MisskeyIdSchema } from '@/models/zod/misc.js';
import { PrismaService } from '@/core/PrismaService.js';

export const meta = {
	tags: ['clip'],
	requireCredential: true,
	prohibitMoved: true,
	kind: 'write:clip-favorite',
} as const;

export const paramDef = z.object({ clipId: MisskeyIdSchema });

@Injectable()
// eslint-disable-next-line import/no-default-export
export default class extends Endpoint<
	typeof meta,
	typeof paramDef,
	z.ZodType<void>
> {
	constructor(
		private readonly idService: IdService,
		private readonly prismaService: PrismaService,
	) {
		super(meta, paramDef, async (ps, me) => {
			await this.prismaService.client.clipFavorite.create({
				data: {
					id: this.idService.genId(),
					createdAt: new Date(),
					clip: {
						connect: {
							id: ps.clipId,
							OR: [{ isPublic: true }, { userId: me.id }],
						},
					},
					user: { connect: { id: me.id } },
				},
			});
		});
	}
}
