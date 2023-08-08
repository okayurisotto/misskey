import { z } from 'zod';
import ms from 'ms';
import { Injectable } from '@nestjs/common';
import { IdService } from '@/core/IdService.js';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import { FlashEntityService } from '@/core/entities/FlashEntityService.js';
import { PrismaService } from '@/core/PrismaService.js';

const res = z.unknown();
export const meta = {
	tags: ['flash'],
	requireCredential: true,
	prohibitMoved: true,
	kind: 'write:flash',
	limit: {
		duration: ms('1hour'),
		max: 10,
	},
	errors: {},
	res,
} as const;

export const paramDef = z.object({
	title: z.string(),
	summary: z.string(),
	script: z.string(),
	permissions: z.array(z.string()),
});

@Injectable()
// eslint-disable-next-line import/no-default-export
export default class extends Endpoint<
	typeof meta,
	typeof paramDef,
	typeof res
> {
	constructor(
		private readonly flashEntityService: FlashEntityService,
		private readonly idService: IdService,
		private readonly prismaService: PrismaService,
	) {
		super(meta, paramDef, async (ps, me) => {
			const flash = await this.prismaService.client.flash.create({
				data: {
					id: this.idService.genId(),
					userId: me.id,
					createdAt: new Date(),
					updatedAt: new Date(),
					title: ps.title,
					summary: ps.summary,
					script: ps.script,
					permissions: ps.permissions,
				},
			});

			return (await this.flashEntityService.pack(flash)) satisfies z.infer<
				typeof res
			>;
		});
	}
}
