import { Injectable } from '@nestjs/common';
import { summaly } from 'summaly';
import { MetaService } from '@/core/MetaService.js';
import { HttpRequestService } from '@/core/HttpRequestService.js';
import Logger from '@/misc/logger.js';
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
		if (url == null) return null;
		if (!/^https?:\/\//.test(url)) return url;

		const proxiedUrl = new URL(
			'preview.webp',
			this.configLoaderService.data.mediaProxy,
		);
		proxiedUrl.searchParams.set('url', url);
		proxiedUrl.searchParams.set('preview', '1');
		return proxiedUrl.href;
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
			const summary = await (async (): ReturnType<typeof summaly> => {
				const lang_ = lang ?? 'ja-JP';

				if (meta.summalyProxy) {
					const proxiedUrl = new URL(meta.summalyProxy);
					proxiedUrl.searchParams.set('url', url);
					proxiedUrl.searchParams.set('lang', lang_);
					return await this.httpRequestService.getJson(proxiedUrl.href);
				} else if (this.configLoaderService.data.proxy) {
					return await summaly(url, {
						followRedirects: false,
						lang: lang_,
						agent: {
							http: this.httpRequestService.httpAgent,
							https: this.httpRequestService.httpsAgent,
						},
					});
				} else {
					return await summaly(url, {
						followRedirects: false,
						lang: lang_,
					});
				}
			})();

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
