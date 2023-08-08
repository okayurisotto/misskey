import { z } from 'zod';
import { Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import { AppEntityService } from '@/core/entities/AppEntityService.js';
import { AppSchema } from '@/models/zod/AppSchema.js';
import { PrismaService } from '@/core/PrismaService.js';

const res = z.array(AppSchema);
export const meta = {
	tags: ['account', 'app'],
	requireCredential: true,
	res,
} as const;

export const paramDef = z.object({
	limit: z.number().int().min(1).max(100).default(10),
	offset: z.number().int().default(0),
});

@Injectable()
// eslint-disable-next-line import/no-default-export
export default class extends Endpoint<
	typeof meta,
	typeof paramDef,
	typeof res
> {
	constructor(
		private readonly appEntityService: AppEntityService,
		private readonly prismaService: PrismaService,
	) {
		super(meta, paramDef, async (ps, me) => {
			const apps = await this.prismaService.client.app.findMany({
				where: { userId: me.id },
				take: ps.limit,
				skip: ps.offset,
			});

			return (await Promise.all(
				apps.map((app) =>
					this.appEntityService.pack(app, me, {
						detail: true,
					}),
				),
			)) satisfies z.infer<typeof res>;
		});
	}
}
