import { z } from 'zod';
import { generateSchema } from '@anatine/zod-openapi';
import { MoreThan } from 'typeorm';
import { Inject, Injectable } from '@nestjs/common';
import { USER_ONLINE_THRESHOLD } from '@/const.js';
import type { UsersRepository } from '@/models/index.js';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import { DI } from '@/di-symbols.js';

const res = z.unknown();
export const meta = {
	tags: ['meta'],
	requireCredential: false,
	allowGet: true,
	cacheSec: 60 * 1,
	res: generateSchema(res),
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
	) {
		super(meta, paramDef_, async () => {
			const count = await this.usersRepository.countBy({
				lastActiveDate: MoreThan(new Date(Date.now() - USER_ONLINE_THRESHOLD)),
			});

			return {
				count,
			} satisfies z.infer<typeof res>;
		});
	}
}
