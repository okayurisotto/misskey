import { z } from 'zod';
import { Injectable } from '@nestjs/common';
import { pick } from 'omick';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import { ClipEntityService } from '@/core/entities/ClipEntityService.js';
import { ClipSchema } from '@/models/zod/ClipSchema.js';
import { MisskeyIdSchema } from '@/models/zod/misc.js';
import { PrismaService } from '@/core/PrismaService.js';

const res = ClipSchema;
export const meta = {
	tags: ['clips'],
	requireCredential: true,
	prohibitMoved: true,
	kind: 'write:account',
	res,
} as const;

export const paramDef = z.object({
	clipId: MisskeyIdSchema,
	name: z.string().min(1).max(100),
	isPublic: z.boolean().optional(),
	description: z.string().min(1).max(2048).nullable().optional(),
});

@Injectable()
// eslint-disable-next-line import/no-default-export
export default class extends Endpoint<
	typeof meta,
	typeof paramDef,
	typeof res
> {
	constructor(
		private readonly clipEntityService: ClipEntityService,
		private readonly prismaService: PrismaService,
	) {
		super(meta, paramDef, async (ps, me) => {
			const result = await this.prismaService.client.clip.update({
				where: { id: ps.clipId, userId: me.id },
				data: pick(ps, ['name', 'description', 'isPublic']),
			});

			return await this.clipEntityService.pack(result, me);
		});
	}
}
