import { z } from 'zod';
import { generateSchema } from '@anatine/zod-openapi';
import { Inject, Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import type { AppsRepository } from '@/models/index.js';
import { IdService } from '@/core/IdService.js';
import { unique } from '@/misc/prelude/array.js';
import { secureRndstr } from '@/misc/secure-rndstr.js';
import { AppEntityService } from '@/core/entities/AppEntityService.js';
import { DI } from '@/di-symbols.js';
import { AppSchema } from '@/models/zod/AppSchema.js';
import { uniqueItems } from '@/models/zod/misc.js';

const res = AppSchema;
export const meta = {
	tags: ['app'],
	requireCredential: false,
	res: generateSchema(res),
} as const;

const paramDef_ = z.object({
	name: z.string(),
	description: z.string(),
	permission: uniqueItems(z.array(z.string())),
	callbackUrl: z.string().nullable().optional(),
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
		@Inject(DI.appsRepository)
		private appsRepository: AppsRepository,

		private appEntityService: AppEntityService,
		private idService: IdService,
	) {
		super(meta, paramDef_, async (ps, me) => {
			// Generate secret
			const secret = secureRndstr(32);

			// for backward compatibility
			const permission = unique(
				ps.permission.map((v) =>
					v.replace(/^(.+)(\/|-)(read|write)$/, '$3:$1'),
				),
			);

			// Create account
			const app = await this.appsRepository
				.insert({
					id: this.idService.genId(),
					createdAt: new Date(),
					userId: me ? me.id : null,
					name: ps.name,
					description: ps.description,
					permission,
					callbackUrl: ps.callbackUrl,
					secret: secret,
				})
				.then((x) => this.appsRepository.findOneByOrFail(x.identifiers[0]));

			return (await this.appEntityService.pack(app, null, {
				detail: true,
				includeSecret: true,
			})) satisfies z.infer<typeof res>;
		});
	}
}
