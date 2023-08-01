import { z } from 'zod';
import { generateSchema } from '@anatine/zod-openapi';
import { Inject, Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import type { SigninsRepository } from '@/models/index.js';
import { QueryService } from '@/core/QueryService.js';
import { SigninEntityService } from '@/core/entities/SigninEntityService.js';
import { DI } from '@/di-symbols.js';
import { misskeyIdPattern } from '@/models/zod/misc.js';

const res = z.unknown();
export const meta = {
	requireCredential: true,
	secure: true,
	res: generateSchema(res),
} as const;

const paramDef_ = z.object({
	limit: z.number().int().min(1).max(100).default(10),
	sinceId: misskeyIdPattern.optional(),
	untilId: misskeyIdPattern.optional(),
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
		@Inject(DI.signinsRepository)
		private signinsRepository: SigninsRepository,

		private signinEntityService: SigninEntityService,
		private queryService: QueryService,
	) {
		super(meta, paramDef_, async (ps, me) => {
			const query = this.queryService
				.makePaginationQuery(
					this.signinsRepository.createQueryBuilder('signin'),
					ps.sinceId,
					ps.untilId,
				)
				.andWhere('signin.userId = :meId', { meId: me.id });

			const history = await query.limit(ps.limit).getMany();

			return await Promise.all(
				history.map((record) => this.signinEntityService.pack(record)),
			) satisfies z.infer<typeof res>;
		});
	}
}
