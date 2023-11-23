import { Injectable } from '@nestjs/common';
import FFmpeg from 'fluent-ffmpeg';
import { ImageProcessingService } from '@/core/ImageProcessingService.js';
import type { IImage } from '@/core/ImageProcessingService.js';
import { createTempDir } from '@/misc/create-temp.js';
import { ConfigLoaderService } from '@/ConfigLoaderService.js';

@Injectable()
export class VideoProcessingService {
	constructor(
		private readonly configLoaderService: ConfigLoaderService,
		private readonly imageProcessingService: ImageProcessingService,
	) {}

	public async generateVideoThumbnail(source: string): Promise<IImage> {
		const [dir, cleanup] = await createTempDir();

		try {
			await new Promise((res, rej) => {
				FFmpeg({
					source,
				})
					.on('end', res)
					.on('error', rej)
					.screenshot({
						folder: dir,
						filename: 'out.png', // must have .png extension
						count: 1,
						timestamps: ['5%'],
					});
			});

			return await this.imageProcessingService.convertToWebp(
				`${dir}/out.png`,
				498,
				422,
			);
		} finally {
			cleanup();
		}
	}

	public getExternalVideoThumbnailUrl(url: string): string | null {
		if (this.configLoaderService.data.videoThumbnailGenerator === null) {
			return null;
		}

		const proxiedUrl = new URL(
			'thumbnail.webp',
			this.configLoaderService.data.videoThumbnailGenerator,
		);
		proxiedUrl.searchParams.set('thumbnail', '1');
		proxiedUrl.searchParams.set('url', url);
		return proxiedUrl.href;
	}
}
