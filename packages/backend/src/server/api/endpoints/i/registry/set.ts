import { z } from 'zod';
import { Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import { IdService } from '@/core/IdService.js';
import { GlobalEventService } from '@/core/GlobalEventService.js';
import { PrismaService } from '@/core/PrismaService.js';

export const meta = {
	requireCredential: true,
	secure: true,
} as const;

export const paramDef = z.object({
	key: z.string().min(1),
	value: z.unknown(),
	scope: z
		.array(z.string().regex(/^[a-zA-Z0-9_]+$/))
		.default([])
		.optional(),
});

@Injectable()
// eslint-disable-next-line import/no-default-export
export default class extends Endpoint<
	typeof meta,
	typeof paramDef,
	z.ZodType<void>
> {
	constructor(
		private readonly idService: IdService,
		private readonly globalEventService: GlobalEventService,
		private readonly prismaService: PrismaService,
	) {
		super(meta, paramDef, async (ps, me) => {
			const existingItem =
				await this.prismaService.client.registry_item.findFirst({
					where: {
						domain: null,
						userId: me.id,
						key: ps.key,
						scope: { equals: ps.scope },
					},
				});

			if (existingItem) {
				await this.prismaService.client.registry_item.update({
					where: { id: existingItem.id },
					data: {
						updatedAt: new Date(),
						value: ps.value,
					},
				});
			} else {
				await this.prismaService.client.registry_item.create({
					data: {
						id: this.idService.genId(),
						createdAt: new Date(),
						updatedAt: new Date(),
						userId: me.id,
						domain: null,
						scope: ps.scope,
						key: ps.key,
						value: ps.value,
					},
				});
			}

			// TODO: サードパーティアプリが傍受出来てしまうのでどうにかする
			this.globalEventService.publishMainStream(me.id, 'registryUpdated', {
				scope: ps.scope,
				key: ps.key,
				value: ps.value,
			});
		});
	}
}
