import { z } from 'zod';
import { generateSchema } from '@anatine/zod-openapi';
import { Inject, Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import type { UserProfilesRepository } from '@/models/index.js';
import { DI } from '@/di-symbols.js';
import { misskeyIdPattern } from '@/models/zod/misc.js';

const res = z.unknown();
export const meta = {
	requireCredential: true,
	res: generateSchema(res),
} as const;

const paramDef_ = z.object({
	userId: misskeyIdPattern,
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
		@Inject(DI.userProfilesRepository)
		private userProfilesRepository: UserProfilesRepository,
	) {
		super(meta, paramDef_, async (ps, me) => {
			const profile = await this.userProfilesRepository.findOneByOrFail({
				userId: ps.userId,
			});

			return profile.achievements satisfies z.infer<typeof res>;
		});
	}
}
