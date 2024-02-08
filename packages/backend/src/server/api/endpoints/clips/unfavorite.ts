import { z } from 'zod';
import { Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import { MisskeyIdSchema } from '@/models/zod/misc.js';
import { PrismaService } from '@/core/PrismaService.js';

export const meta = {
	tags: ['clip'],
	requireCredential: true,
	prohibitMoved: true,
	kind: 'write:clip-favorite',
} as const;

export const paramDef = z.object({
	clipId: MisskeyIdSchema,
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
			await this.prismaService.client.clipFavorite.delete({
				where: { userId_clipId: { clipId: ps.clipId, userId: me.id } },
			});
		});
	}
}
