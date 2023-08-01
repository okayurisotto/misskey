import { z } from 'zod';
import { generateSchema } from '@anatine/zod-openapi';
import { Inject, Injectable } from '@nestjs/common';
import type { UserIpsRepository } from '@/models/index.js';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import { DI } from '@/di-symbols.js';
import { misskeyIdPattern } from '@/models/zod/misc.js';

const res = z.unknown(); // TODO
export const meta = {
	tags: ['admin'],
	requireCredential: true,
	requireModerator: true,
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
		@Inject(DI.userIpsRepository)
		private userIpsRepository: UserIpsRepository,
	) {
		super(meta, paramDef_, async (ps, me) => {
			const ips = await this.userIpsRepository.find({
				where: { userId: ps.userId },
				order: { createdAt: 'DESC' },
				take: 30,
			});

			return ips.map((x) => ({
				ip: x.ip,
				createdAt: x.createdAt.toISOString(),
			})) satisfies z.infer<typeof res>;
		});
	}
}
