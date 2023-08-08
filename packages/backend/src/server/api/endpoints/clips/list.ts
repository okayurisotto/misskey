import { z } from 'zod';
import { Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import { ClipEntityService } from '@/core/entities/ClipEntityService.js';
import { ClipSchema } from '@/models/zod/ClipSchema.js';
import { PrismaService } from '@/core/PrismaService.js';

const res = z.array(ClipSchema);
export const meta = {
	tags: ['clips', 'account'],
	requireCredential: true,
	kind: 'read:account',
	res,
} as const;

export const paramDef = z.object({});

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
			const clips = await this.prismaService.client.clip.findMany({
				where: { userId: me.id },
			});

			return (await Promise.all(
				clips.map((clip) => this.clipEntityService.pack(clip, me)),
			)) satisfies z.infer<typeof res>;
		});
	}
}
