import { Injectable } from '@nestjs/common';
import { ConfigLoaderService } from '@/ConfigLoaderService.js';
import { DriveFileProxiedUrlGenerationService } from './DriveFileProxiedUrlGenerationService.js';
import type { DriveFile } from '@prisma/client';

@Injectable()
export class DriveFilePublicUrlGenerationService {
	constructor(
		private readonly configLoaderService: ConfigLoaderService,
		private readonly driveFileProxiedUrlGenerationService: DriveFileProxiedUrlGenerationService,
	) {}

	public generate(file: DriveFile, mode?: 'avatar'): string {
		// リモートのファイル && 外部のメディアプロキシを経由する設定になっている
		if (
			file.uri !== null &&
			file.userHost !== null &&
			this.configLoaderService.data.externalMediaProxyEnabled
		) {
			return this.driveFileProxiedUrlGenerationService.generate(file.uri, mode);
		}

		// リモートのファイル && 期限切れにより`isLink`が`true`になっている && リモートファイルをプロキシする設定になっている
		if (
			file.uri != null &&
			file.isLink &&
			this.configLoaderService.data.proxyRemoteFiles
		) {
			const key = file.webpublicAccessKey;

			// 古いものは`key`にオブジェクトストレージキーが入ってしまっているので除外する
			if (key && !key.includes('/')) {
				const url = `${this.configLoaderService.data.url}/files/${key}`; // TODO: 直接メディアプロキシを指定しても問題ないはず？
				if (mode === 'avatar') {
					return this.driveFileProxiedUrlGenerationService.generate(
						file.uri,
						'avatar',
					);
				}
				return url;
			}
		}

		const url = file.webpublicUrl ?? file.url;

		if (mode === 'avatar') {
			return this.driveFileProxiedUrlGenerationService.generate(url, 'avatar');
		}
		return url;
	}
}
