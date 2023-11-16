import { z } from 'zod';
import Parser from 'rss-parser';
import { Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import { HttpRequestService } from '@/core/HttpRequestService.js';

const rssParser = new Parser();

const res = z.record(z.string(), z.unknown());
export const meta = {
	tags: ['meta'],
	requireCredential: false,
	allowGet: true,
	cacheSec: 60 * 3,
	res,
} as const;

export const paramDef = z.object({
	url: z.string(),
});

@Injectable()
// eslint-disable-next-line import/no-default-export
export default class extends Endpoint<
	typeof meta,
	typeof paramDef,
	typeof res
> {
	constructor(private readonly httpRequestService: HttpRequestService) {
		super(meta, paramDef, async (ps) => {
			const res_ = await this.httpRequestService.send(ps.url, {
				method: 'GET',
				headers: {
					Accept: 'application/rss+xml, */*',
				},
				timeout: 5000,
			});

			const text = await res_.text();

			return await rssParser.parseString(text);
		});
	}
}
