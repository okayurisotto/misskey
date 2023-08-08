import { z } from 'zod';
import { Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import { UserEntityService } from '@/core/entities/UserEntityService.js';
import { MeDetailedSchema } from '@/models/zod/MeDetailedSchema.js';
import { PrismaService } from '@/core/PrismaService.js';
import { ApiError } from '../error.js';

const res = MeDetailedSchema;
export const meta = {
	tags: ['account'],
	requireCredential: true,
	res,
	errors: {
		userIsDeleted: {
			message: 'User is deleted.',
			code: 'USER_IS_DELETED',
			id: 'e5b3b9f0-2b8f-4b9f-9c1f-8c5c1b2e1b1a',
			kind: 'permission',
		},
	},
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
		private readonly userEntityService: UserEntityService,
		private readonly prismaService: PrismaService,
	) {
		super(meta, paramDef, async (ps, user, token) => {
			const isSecure = token == null;

			const now = new Date();
			const today = `${now.getFullYear()}/${
				now.getMonth() + 1
			}/${now.getDate()}`;

			// 渡ってきている user はキャッシュされていて古い可能性があるので改めて取得
			const userProfile =
				await this.prismaService.client.user_profile.findUnique({
					where: { userId: user.id },
					include: { user: true },
				});

			if (userProfile == null) {
				throw new ApiError(meta.errors.userIsDeleted);
			}

			if (!userProfile.loggedInDates.includes(today)) {
				await this.prismaService.client.user_profile.update({
					where: { userId: user.id },
					data: { loggedInDates: { push: today } },
				});
				userProfile.loggedInDates = [...userProfile.loggedInDates, today];
			}

			return (await this.userEntityService.pack<true, true>(
				userProfile.user,
				userProfile.user,
				{
					detail: true,
					includeSecrets: isSecure,
					userProfile,
				},
			)) satisfies z.infer<typeof res>;
		});
	}
}
