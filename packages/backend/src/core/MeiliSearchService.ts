import { Inject, Injectable } from '@nestjs/common';
import { MeiliSearch } from 'meilisearch';
import { DI } from '@/di-symbols.js';
import type { Config } from '@/config.js';

@Injectable()
export class MeiliSearchService {
	public readonly instance: MeiliSearch | null = null;

	constructor(@Inject(DI.config) config: Config) {
		if (config.meilisearch) {
			this.instance = new MeiliSearch({
				host: `${config.meilisearch.ssl ? 'https' : 'http'}://${config.meilisearch.host}:${config.meilisearch.port}`,
				apiKey: config.meilisearch.apiKey,
			});
		}
	}
}
