import { Injectable } from '@nestjs/common';
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
		const proxiedUrl = new URL(
			`${mode ?? 'image'}.webp`,
			this.configLoaderService.data.mediaProxy,
		);
		proxiedUrl.searchParams.set('url', url);
		if (mode !== undefined) proxiedUrl.searchParams.set(mode, '1');
		return proxiedUrl.href;
	}
}
