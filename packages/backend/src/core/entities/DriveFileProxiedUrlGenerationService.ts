import { Injectable } from '@nestjs/common';
import { appendQuery, query } from '@/misc/prelude/url.js';
import { ConfigLoaderService } from '@/ConfigLoaderService.js';

@Injectable()
export class DriveFileProxiedUrlGenerationService {
	constructor(private readonly configLoaderService: ConfigLoaderService) {}

	/**
	 * mediaProxy経由のURLに変換する。
	 *
	 * @example `https://media-proxy.example.com/${mode}.webp?url=${url}&${mode}=1`
	 *
	 * @param url
	 * @param mode
	 * @returns
	 */
	public generate(url: string, mode?: 'static' | 'avatar'): string {
		return appendQuery(
			`${this.configLoaderService.data.mediaProxy}/${mode ?? 'image'}.webp`,
			query({
				url,
				...(mode ? { [mode]: '1' } : {}),
			}),
		);
	}
}
