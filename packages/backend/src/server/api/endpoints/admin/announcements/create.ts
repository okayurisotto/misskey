import { z } from 'zod';
import { Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import { IdService } from '@/core/IdService.js';
import { MisskeyIdSchema } from '@/models/zod/misc.js';
import { PrismaService } from '@/core/PrismaService.js';

const res = z.object({
	id: MisskeyIdSchema,
	createdAt: z.string().datetime(),
	updatedAt: z.string().datetime().nullable(),
	title: z.string(),
	text: z.string(),
	imageUrl: z.string().nullable(),
});
export const meta = {
	tags: ['admin'],
	requireCredential: true,
	requireModerator: true,
	res,
} as const;

export const paramDef = z.object({
	title: z.string().min(1),
	text: z.string().min(1),
	imageUrl: z.string().min(1).nullable(),
});

@Injectable()
// eslint-disable-next-line import/no-default-export
export default class extends Endpoint<
	typeof meta,
	typeof paramDef,
	typeof res
> {
	constructor(
		private readonly idService: IdService,
		private readonly prismaService: PrismaService,
	) {
		super(meta, paramDef, async (ps) => {
			const announcement = await this.prismaService.client.announcement.create({
				data: {
					id: this.idService.genId(),
					createdAt: new Date(),
					updatedAt: null,
					title: ps.title,
					text: ps.text,
					imageUrl: ps.imageUrl,
				},
			});

			return {
				...announcement,
				createdAt: announcement.createdAt.toISOString(),
				updatedAt: null,
			} satisfies z.infer<typeof res>;
		});
	}
}
