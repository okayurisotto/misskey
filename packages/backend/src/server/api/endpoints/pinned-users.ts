import { z } from 'zod';
import { Injectable } from '@nestjs/common';
import * as Acct from '@/misc/acct.js';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import { MetaService } from '@/core/MetaService.js';
import { UserEntityService } from '@/core/entities/UserEntityService.js';
import { UserDetailedSchema } from '@/models/zod/UserDetailedSchema.js';
import { PrismaService } from '@/core/PrismaService.js';
import type { user } from '@prisma/client';

const res = z.array(UserDetailedSchema);
export const meta = {
	tags: ['users'],
	requireCredential: false,
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
		private readonly metaService: MetaService,
		private readonly userEntityService: UserEntityService,
		private readonly prismaService: PrismaService,
	) {
		super(meta, paramDef, async (ps, me) => {
			const meta = await this.metaService.fetch();

			const users = await Promise.all(
				meta.pinnedUsers
					.map((acct) => Acct.parse(acct))
					.map((acct) =>
						this.prismaService.client.user.findFirst({
							where: {
								usernameLower: acct.username.toLowerCase(),
								host: acct.host ?? null,
							},
						}),
					),
			);

			return (await Promise.all(
				users
					.filter((user): user is user => user !== null)
					.map((user) => this.userEntityService.packDetailed(user, me)),
			)) satisfies z.infer<typeof res>;
		});
	}
}
