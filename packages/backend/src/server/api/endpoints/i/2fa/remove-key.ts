import { z } from 'zod';
import { generateSchema } from '@anatine/zod-openapi';
import bcrypt from 'bcryptjs';
import { Inject, Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import type {
	UserProfilesRepository,
	UserSecurityKeysRepository,
} from '@/models/index.js';
import { UserEntityService } from '@/core/entities/UserEntityService.js';
import { GlobalEventService } from '@/core/GlobalEventService.js';
import { DI } from '@/di-symbols.js';

const res = z.unknown();
export const meta = {
	requireCredential: true,
	secure: true,
	res: generateSchema(res),
} as const;

const paramDef_ = z.object({
	password: z.string(),
	credentialId: z.string(),
});
export const paramDef = generateSchema(paramDef_);

@Injectable()
// eslint-disable-next-line import/no-default-export
export default class extends Endpoint<
	typeof meta,
	typeof paramDef_,
	typeof res
> {
	constructor(
		@Inject(DI.userSecurityKeysRepository)
		private userSecurityKeysRepository: UserSecurityKeysRepository,

		@Inject(DI.userProfilesRepository)
		private userProfilesRepository: UserProfilesRepository,

		private userEntityService: UserEntityService,
		private globalEventService: GlobalEventService,
	) {
		super(meta, paramDef_, async (ps, me) => {
			const profile = await this.userProfilesRepository.findOneByOrFail({
				userId: me.id,
			});

			// Compare password
			const same = await bcrypt.compare(ps.password, profile.password!);

			if (!same) {
				throw new Error('incorrect password');
			}

			// Make sure we only delete the user's own creds
			await this.userSecurityKeysRepository.delete({
				userId: me.id,
				id: ps.credentialId,
			});

			// 使われているキーがなくなったらパスワードレスログインをやめる
			const keyCount = await this.userSecurityKeysRepository.count({
				where: {
					userId: me.id,
				},
				select: {
					id: true,
					name: true,
					lastUsed: true,
				},
			});

			if (keyCount === 0) {
				await this.userProfilesRepository.update(me.id, {
					usePasswordLessLogin: false,
				});
			}

			// Publish meUpdated event
			this.globalEventService.publishMainStream(
				me.id,
				'meUpdated',
				await this.userEntityService.pack(me.id, me, {
					detail: true,
					includeSecrets: true,
				}),
			);

			return {} satisfies z.infer<typeof res>;
		});
	}
}
