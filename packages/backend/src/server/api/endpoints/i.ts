import { z } from 'zod';
import { generateSchema } from '@anatine/zod-openapi';
import { Inject, Injectable } from '@nestjs/common';
import type {
	UserProfilesRepository,
	UsersRepository,
} from '@/models/index.js';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import { UserEntityService } from '@/core/entities/UserEntityService.js';
import { DI } from '@/di-symbols.js';
import { MeDetailedSchema } from '@/models/zod/MeDetailedSchema.js';
import { ApiError } from '../error.js';

const res = MeDetailedSchema;
export const meta = {
	tags: ['account'],
	requireCredential: true,
	res: generateSchema(res),
	errors: {
		userIsDeleted: {
			message: 'User is deleted.',
			code: 'USER_IS_DELETED',
			id: 'e5b3b9f0-2b8f-4b9f-9c1f-8c5c1b2e1b1a',
			kind: 'permission',
		},
	},
} as const;

const paramDef_ = z.object({});
export const paramDef = generateSchema(paramDef_);

@Injectable()
// eslint-disable-next-line import/no-default-export
export default class extends Endpoint<
	typeof meta,
	typeof paramDef_,
	typeof res
> {
	constructor(
		@Inject(DI.usersRepository)
		private usersRepository: UsersRepository,

		@Inject(DI.userProfilesRepository)
		private userProfilesRepository: UserProfilesRepository,

		private userEntityService: UserEntityService,
	) {
		super(meta, paramDef_, async (ps, user, token) => {
			const isSecure = token == null;

			const now = new Date();
			const today = `${now.getFullYear()}/${
				now.getMonth() + 1
			}/${now.getDate()}`;

			// 渡ってきている user はキャッシュされていて古い可能性があるので改めて取得
			const userProfile = await this.userProfilesRepository.findOne({
				where: {
					userId: user.id,
				},
				relations: ['user'],
			});

			if (userProfile == null) {
				throw new ApiError(meta.errors.userIsDeleted);
			}

			if (!userProfile.loggedInDates.includes(today)) {
				this.userProfilesRepository.update(
					{ userId: user.id },
					{
						loggedInDates: [...userProfile.loggedInDates, today],
					},
				);
				userProfile.loggedInDates = [...userProfile.loggedInDates, today];
			}

			return (await this.userEntityService.pack<true, true>(
				userProfile.user!,
				userProfile.user!,
				{
					detail: true,
					includeSecrets: isSecure,
					userProfile,
				},
			)) satisfies z.infer<typeof res>;
		});
	}
}
