import { MeiliSearch } from 'meilisearch';
import { Injectable } from '@nestjs/common';
import { ConfigLoaderService } from '@/ConfigLoaderService.js';

@Injectable()
export class MeiliSearchService {
	public readonly instance: MeiliSearch | null = null;

	constructor(configLoaderService: ConfigLoaderService) {
		if (configLoaderService.data.meilisearch) {
			this.instance = new MeiliSearch({
				host: `${
					configLoaderService.data.meilisearch.ssl ? 'https' : 'http'
				}://${configLoaderService.data.meilisearch.host}:${
					configLoaderService.data.meilisearch.port
				}`,
				apiKey: configLoaderService.data.meilisearch.apiKey,
			});
		}
	}
}
