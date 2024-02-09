import { Injectable } from '@nestjs/common';
import type { RemoteUser } from '@/models/entities/User.js';
import { MetaService } from '@/core/MetaService.js';
import { truncate } from '@/misc/truncate.js';
import { DB_MAX_IMAGE_COMMENT_LENGTH } from '@/const.js';
import { checkHttps } from '@/misc/check-https.js';
import { PrismaService } from '@/core/PrismaService.js';
import { DriveFileAddFromUrlService } from '@/core/DriveFileAddFromUrlService.js';
import { ApResolverService } from '../ApResolverService.js';
import { ApLoggerService } from '../ApLoggerService.js';
import type { IObject } from '../type.js';
import type { DriveFile } from '@prisma/client';

@Injectable()
export class ApImageCreateService {
	private readonly logger;

	constructor(
		private readonly apLoggerService: ApLoggerService,
		private readonly apResolverService: ApResolverService,
		private readonly driveFileAddFromUrlService: DriveFileAddFromUrlService,
		private readonly metaService: MetaService,
		private readonly prismaService: PrismaService,
	) {
		this.logger = this.apLoggerService.logger;
	}

	/**
	 * Imageを作成します。
	 */
	public async create(
		actor: RemoteUser,
		value: string | IObject,
	): Promise<DriveFile> {
		// 投稿者が凍結されていたらスキップ
		if (actor.isSuspended) {
			throw new Error('actor has been suspended');
		}

		const image = await this.apResolverService.createResolver().resolve(value);

		if (image.url == null) {
			throw new Error('invalid image: url not provided');
		}

		if (typeof image.url !== 'string') {
			throw new Error(
				'invalid image: unexpected type of url: ' +
					JSON.stringify(image.url, null, 2),
			);
		}

		if (!checkHttps(image.url)) {
			throw new Error('invalid image: unexpected schema of url: ' + image.url);
		}

		this.logger.info(`Creating the Image: ${image.url}`);

		const instance = await this.metaService.fetch();

		// Cache if remote file cache is on AND either
		// 1. remote sensitive file is also on
		// 2. or the image is not sensitive
		const shouldBeCached =
			instance.cacheRemoteFiles &&
			(instance.cacheRemoteSensitiveFiles || !image.sensitive);

		const file = await this.driveFileAddFromUrlService.addFromUrl({
			url: image.url,
			user: actor,
			uri: image.url,
			sensitive: image.sensitive,
			isLink: !shouldBeCached,
			comment: truncate(image.name ?? undefined, DB_MAX_IMAGE_COMMENT_LENGTH),
		});
		if (!file.isLink || file.url === image.url) return file;

		// URLが異なっている場合、同じ画像が以前に異なるURLで登録されていたということなので、URLを更新する
		await this.prismaService.client.driveFile.update({
			where: { id: file.id },
			data: { url: image.url, uri: image.url },
		});
		return await this.prismaService.client.driveFile.findUniqueOrThrow({
			where: { id: file.id },
		});
	}
}
