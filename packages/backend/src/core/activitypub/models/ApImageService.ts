import { Injectable } from '@nestjs/common';
import type { RemoteUser } from '@/models/entities/User.js';
import { MetaService } from '@/core/MetaService.js';
import { truncate } from '@/misc/truncate.js';
import { DB_MAX_IMAGE_COMMENT_LENGTH } from '@/const.js';
import { DriveService } from '@/core/DriveService.js';
import type Logger from '@/misc/logger.js';
import { bindThis } from '@/decorators.js';
import { checkHttps } from '@/misc/check-https.js';
import { PrismaService } from '@/core/PrismaService.js';
import { ApResolverService } from '../ApResolverService.js';
import { ApLoggerService } from '../ApLoggerService.js';
import type { IObject } from '../type.js';
import type { drive_file } from '@prisma/client';

@Injectable()
export class ApImageService {
	private logger: Logger;

	constructor(
		private readonly metaService: MetaService,
		private readonly apResolverService: ApResolverService,
		private readonly driveService: DriveService,
		private readonly apLoggerService: ApLoggerService,
		private readonly prismaService: PrismaService,
	) {
		this.logger = this.apLoggerService.logger;
	}

	/**
	 * Imageを作成します。
	 */
	@bindThis
	public async createImage(actor: RemoteUser, value: string | IObject): Promise<drive_file> {
		// 投稿者が凍結されていたらスキップ
		if (actor.isSuspended) {
			throw new Error('actor has been suspended');
		}

		const image = await this.apResolverService.createResolver().resolve(value);

		if (image.url == null) {
			throw new Error('invalid image: url not provided');
		}

		if (typeof image.url !== 'string') {
			throw new Error('invalid image: unexpected type of url: ' + JSON.stringify(image.url, null, 2));
		}

		if (!checkHttps(image.url)) {
			throw new Error('invalid image: unexpected schema of url: ' + image.url);
		}

		this.logger.info(`Creating the Image: ${image.url}`);

		const instance = await this.metaService.fetch();

		// Cache if remote file cache is on AND either
		// 1. remote sensitive file is also on
		// 2. or the image is not sensitive
		const shouldBeCached = instance.cacheRemoteFiles && (instance.cacheRemoteSensitiveFiles || !image.sensitive);

		const file = await this.driveService.uploadFromUrl({
			url: image.url,
			user: actor,
			uri: image.url,
			sensitive: image.sensitive,
			isLink: !shouldBeCached,
			comment: truncate(image.name ?? undefined, DB_MAX_IMAGE_COMMENT_LENGTH),
		});
		if (!file.isLink || file.url === image.url) return file;

		// URLが異なっている場合、同じ画像が以前に異なるURLで登録されていたということなので、URLを更新する
		await this.prismaService.client.drive_file.update({
			where: { id: file.id },
			data: { url: image.url, uri: image.url },
		});
		return await this.prismaService.client.drive_file.findUniqueOrThrow({ where: { id: file.id } });
	}

	/**
	 * Imageを解決します。
	 *
	 * Misskeyに対象のImageが登録されていればそれを返し、そうでなければ
	 * リモートサーバーからフェッチしてMisskeyに登録しそれを返します。
	 */
	@bindThis
	public async resolveImage(actor: RemoteUser, value: string | IObject): Promise<drive_file> {
		// TODO

		// リモートサーバーからフェッチしてきて登録
		return await this.createImage(actor, value);
	}
}
