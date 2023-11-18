import { URL } from 'node:url';
import { Injectable } from '@nestjs/common';
import { query as urlQuery } from '@/misc/prelude/url.js';
import { HttpRequestService } from '@/core/HttpRequestService.js';
import { MISSKEY_WEBFINGER_USE_HTTP } from '@/env.js';

export type ILink = {
	href: string;
	rel?: string;
};

export type IWebFinger = {
	links: ILink[];
	subject: string;
};

const urlRegex = /^https?:\/\//;
const mRegex = /^([^@]+)@(.*)/;

@Injectable()
export class WebfingerService {
	constructor(private readonly httpRequestService: HttpRequestService) {}

	public async webfinger(query: string): Promise<IWebFinger> {
		const url = this.genUrl(query);

		return await this.httpRequestService.getJson<IWebFinger>(
			url,
			'application/jrd+json, application/json',
		);
	}

	private genUrl(query: string): string {
		if (query.match(urlRegex)) {
			const u = new URL(query);
			return (
				`${u.protocol}//${u.hostname}/.well-known/webfinger?` +
				urlQuery({ resource: query })
			);
		}

		const m = query.match(mRegex);
		if (m) {
			const hostname = m[2];
			const useHttp =
				MISSKEY_WEBFINGER_USE_HTTP &&
				MISSKEY_WEBFINGER_USE_HTTP.toLowerCase() === 'true';
			return `http${
				useHttp ? '' : 's'
			}://${hostname}/.well-known/webfinger?${urlQuery({
				resource: `acct:${query}`,
			})}`;
		}

		throw new Error(`Invalid query (${query})`);
	}
}
