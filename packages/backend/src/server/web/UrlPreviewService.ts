import { Injectable } from '@nestjs/common';
import { summaly } from 'summaly';
import { MetaService } from '@/core/MetaService.js';
import { HttpRequestService } from '@/core/HttpRequestService.js';
import Logger from '@/misc/logger.js';
import { query } from '@/misc/prelude/url.js';
import { ApiError } from '@/server/api/error.js';
import { ConfigLoaderService } from '@/ConfigLoaderService.js';
import type { FastifyRequest, FastifyReply } from 'fastify';

@Injectable()
export class UrlPreviewService {
	private readonly logger = new Logger('url-preview');

	constructor(
		private readonly configLoaderService: ConfigLoaderService,
		private readonly httpRequestService: HttpRequestService,
		private readonly metaService: MetaService,
	) {}

	private wrap(url?: string | null): string | null {
		return url != null
			? url.match(/^https?:\/\//)
				? `${this.configLoaderService.data.mediaProxy}/preview.webp?${query({
						url,
						preview: '1',
				  })}`
				: url
			: null;
	}

	public async handle(
		request: FastifyRequest<{ Querystring: { url: string; lang?: string } }>,
		reply: FastifyReply,
	): Promise<object | undefined> {
		const url = request.query.url;
		if (typeof url !== 'string') {
			reply.code(400);
			return;
		}

		const lang = request.query.lang;
		if (Array.isArray(lang)) {
			reply.code(400);
			return;
		}

		const meta = await this.metaService.fetch();

		this.logger.info(
			meta.summalyProxy
				? `(Proxy) Getting preview of ${url}@${lang} ...`
				: `Getting preview of ${url}@${lang} ...`,
		);
		try {
			const summary = meta.summalyProxy
				? await this.httpRequestService.getJson<ReturnType<typeof summaly>>(
						`${meta.summalyProxy}?${query({
							url: url,
							lang: lang ?? 'ja-JP',
						})}`,
				  )
				: await summaly(url, {
						followRedirects: false,
						lang: lang ?? 'ja-JP',
						agent: this.configLoaderService.data.proxy
							? {
									http: this.httpRequestService.httpAgent,
									https: this.httpRequestService.httpsAgent,
							  }
							: undefined,
				  });

			this.logger.succ(`Got preview of ${url}: ${summary.title}`);

			if (
				!(
					summary.url.startsWith('http://') ||
					summary.url.startsWith('https://')
				)
			) {
				throw new Error('unsupported schema included');
			}

			if (
				summary.player.url &&
				!(
					summary.player.url.startsWith('http://') ||
					summary.player.url.startsWith('https://')
				)
			) {
				throw new Error('unsupported schema included');
			}

			summary.icon = this.wrap(summary.icon);
			summary.thumbnail = this.wrap(summary.thumbnail);

			// Cache 7days
			reply.header('Cache-Control', 'max-age=604800, immutable');

			return summary;
		} catch (err) {
			this.logger.warn(`Failed to get preview of ${url}: ${err}`);
			reply.code(422);
			reply.header('Cache-Control', 'max-age=86400, immutable');
			return {
				error: new ApiError({
					message: 'Failed to get preview',
					code: 'URL_PREVIEW_FAILED',
					id: '09d01cb5-53b9-4856-82e5-38a50c290a3b',
				}),
			};
		}
	}
}
