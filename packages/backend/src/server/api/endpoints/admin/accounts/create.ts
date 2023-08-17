import { z } from 'zod';
import { Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import { SignupService } from '@/core/SignupService.js';
import { UserEntityService } from '@/core/entities/UserEntityService.js';
import { PasswordSchema, LocalUsernameSchema } from '@/models/zod/misc.js';
import { PrismaService } from '@/core/PrismaService.js';
import { UserDetailedNotMeSchema } from '@/models/zod/UserDetailedNotMeSchema.js';

const res = UserDetailedNotMeSchema.extend({ token: z.string() });
export const meta = {
	tags: ['admin'],
	res,
} as const;

export const paramDef = z.object({
	username: LocalUsernameSchema,
	password: PasswordSchema,
});

@Injectable()
// eslint-disable-next-line import/no-default-export
export default class extends Endpoint<
	typeof meta,
	typeof paramDef,
	typeof res
> {
	constructor(
		private readonly userEntityService: UserEntityService,
		private readonly signupService: SignupService,
		private readonly prismaService: PrismaService,
	) {
		super(meta, paramDef, async (ps, me) => {
			const noUsers =
				(await this.prismaService.client.user.count({
					where: { host: null },
					take: 1,
				})) === 0;

			if (noUsers) {
				// ok
			} else {
				if (me === null) {
					throw new Error('access denied');
				} else {
					const me_ = await this.prismaService.client.user.findUnique({
						where: { id: me.id },
					});

					if (me_ === null) {
						throw new Error();
					} else {
						if (me_.isRoot) {
							// ok
						} else {
							throw new Error('access denied');
						}
					}
				}
			}

			const { account, secret } = await this.signupService.signup({
				username: ps.username,
				password: ps.password,
				ignorePreservedUsernames: true,
			});

			const packed = await this.userEntityService.pack(account, account, {
				detail: true,
				includeSecrets: true,
			});

			return {
				...packed,
				token: secret,
			} satisfies z.infer<typeof res>;
		});
	}
}
