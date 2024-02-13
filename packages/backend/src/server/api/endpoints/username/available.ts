import { z } from 'zod';
import { Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import { MetaService } from '@/core/MetaService.js';
import { LocalUsernameSchema } from '@/models/zod/misc.js';
import { PrismaService } from '@/core/PrismaService.js';

const res = z.object({
	available: z.boolean(),
});
export const meta = {
	tags: ['users'],
	requireCredential: false,
	res,
} as const;

export const paramDef = z.object({
	username: LocalUsernameSchema,
});

@Injectable()
// eslint-disable-next-line import/no-default-export
export default class extends Endpoint<
	typeof meta,
	typeof paramDef,
	typeof res
> {
	constructor(
		private readonly metaService: MetaService,
		private readonly prismaService: PrismaService,
	) {
		super(meta, paramDef, async (ps) => {
			const exist = await this.prismaService.client.user.count({
				where: {
					host: null,
					usernameLower: ps.username.toLowerCase(),
				},
			});

			const exist2 = await this.prismaService.client.usedUsername.count({
				where: {
					username: ps.username.toLowerCase(),
				},
			});

			const meta = await this.metaService.fetch();
			const isPreserved = meta.preservedUsernames
				.map((x) => x.toLowerCase())
				.includes(ps.username.toLowerCase());

			return {
				available: exist === 0 && exist2 === 0 && !isPreserved,
			};
		});
	}
}
