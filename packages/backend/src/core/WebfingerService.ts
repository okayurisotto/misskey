import { URL } from 'node:url';
import { Injectable } from '@nestjs/common';
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

const URL_PATTERN = /^https?:\/\//;
const MENTION_PATTERN = /^([^@]+)@(.*)/;

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
		if (URL_PATTERN.test(query)) {
			const parsedUrl = new URL(query);
			const url = new URL(
				'/.well-known/webfinger',
				`${parsedUrl.protocol}//${parsedUrl.hostname}`, // without port?
			);
			url.searchParams.set('resource', query);
			return url.href;
		}

		const mention = query.match(MENTION_PATTERN);
		if (mention) {
			const hostname = mention[2];
			const useHttp =
				MISSKEY_WEBFINGER_USE_HTTP &&
				MISSKEY_WEBFINGER_USE_HTTP.toLowerCase() === 'true';
			const protocol = useHttp ? 'http:' : 'https:';
			const url = new URL('/.well-known/webfinger', `${protocol}//${hostname}`); // without port?
			url.searchParams.set('resource', `acct:${query}`);
			return url.href;
		}

		throw new Error(`Invalid query (${query})`);
	}
}
