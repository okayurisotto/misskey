import { z } from 'zod';
import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
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
				(await this.prismaService.client.user.findFirst({
					where: { host: null },
				})) === null;

			if (noUsers) {
				// ok
			} else {
				if (me === null) {
					throw new Error('You must be logged in to perform this action.');
				} else {
					const me_ = await this.prismaService.client.user.findUnique({
						where: { id: me.id, isRoot: true },
					});

					if (me_ === null) {
						throw new Error(
							'You are not authorized to perform this operation.',
						);
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
			};
		});
	}
}
