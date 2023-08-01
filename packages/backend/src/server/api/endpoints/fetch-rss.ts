import { z } from 'zod';
import { generateSchema } from '@anatine/zod-openapi';
import Parser from 'rss-parser';
import { Inject, Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import type { Config } from '@/config.js';
import { DI } from '@/di-symbols.js';
import { HttpRequestService } from '@/core/HttpRequestService.js';

const rssParser = new Parser();

const res = z.unknown();
export const meta = {
	tags: ['meta'],
	requireCredential: false,
	allowGet: true,
	cacheSec: 60 * 3,
	res: generateSchema(res),
} as const;

const paramDef_ = z.object({
	url: z.string(),
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
		@Inject(DI.config)
		private config: Config,

		private httpRequestService: HttpRequestService,
	) {
		super(meta, paramDef_, async (ps, me) => {
			const res_ = await this.httpRequestService.send(ps.url, {
				method: 'GET',
				headers: {
					Accept: 'application/rss+xml, */*',
				},
				timeout: 5000,
			});

			const text = await res_.text();

			return rssParser.parseString(text) satisfies z.infer<typeof res>;
		});
	}
}
