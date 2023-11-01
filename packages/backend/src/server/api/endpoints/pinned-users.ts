import { z } from 'zod';
import { Injectable } from '@nestjs/common';
import * as Acct from '@/misc/acct.js';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import { MetaService } from '@/core/MetaService.js';
import { UserEntityService } from '@/core/entities/UserEntityService.js';
import { UserDetailedSchema } from '@/models/zod/UserDetailedSchema.js';
import { PrismaService } from '@/core/PrismaService.js';

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

			const accts = meta.pinnedUsers
				.map((acct) => Acct.parse(acct))
				.map(({ username, host }) => ({
					usernameLower: username.toLowerCase(),
					host,
				}));

			const users = await this.prismaService.client.user.findMany({
				where: {
					OR: accts.map((acct) => ({
						usernameLower: acct.usernameLower,
						host: acct.host,
					})),
				},
			});

			return (await Promise.all(
				accts
					.map((acct) => {
						const user = users.find((user) => {
							if (user.usernameLower !== acct.usernameLower) return false;
							if (user.host !== acct.host) return false;
							return true;
						});
						if (user === undefined) throw new Error();
						return user;
					})
					.map((user) => this.userEntityService.packDetailed(user, me)),
			)) satisfies z.infer<typeof res>;
		});
	}
}
