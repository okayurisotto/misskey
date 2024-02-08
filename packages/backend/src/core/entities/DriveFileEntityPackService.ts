import { Injectable } from '@nestjs/common';
import { z } from 'zod';
import { deepClone } from '@/misc/clone.js';
import type { DriveFileSchema } from '@/models/zod/DriveFileSchema.js';
import { isMimeImage } from '@/misc/is-mime-image.js';
import { isNotNull } from '@/misc/is-not-null.js';
import { PrismaService } from '@/core/PrismaService.js';
import { ConfigLoaderService } from '@/ConfigLoaderService.js';
import { VideoProcessingService } from '../VideoProcessingService.js';
import { DriveFolderEntityService } from './DriveFolderEntityService.js';
import { DriveFileProxiedUrlGenerationService } from './DriveFileProxiedUrlGenerationService.js';
import { DriveFilePublicUrlGenerationService } from './DriveFilePublicUrlGenerationService.js';
import { UserEntityPackLiteService } from './UserEntityPackLiteService.js';
import type { DriveFile } from '@prisma/client';

type PackOptions = {
	detail?: boolean;
	self?: boolean;
	withUser?: boolean;
};

const DriveFilePropertiesSchema = z.object({
	width: z.number().optional(),
	height: z.number().optional(),
	orientation: z.number().optional(),
	avgColor: z.string().optional(),
});

@Injectable()
export class DriveFileEntityPackService {
	constructor(
		private readonly configLoaderService: ConfigLoaderService,
		private readonly driveFileProxiedUrlGenerationService: DriveFileProxiedUrlGenerationService,
		private readonly driveFilePublicUrlGenerationService: DriveFilePublicUrlGenerationService,
		private readonly driveFolderEntityService: DriveFolderEntityService,
		private readonly prismaService: PrismaService,
		private readonly videoProcessingService: VideoProcessingService,
		private readonly userEntityPackLiteService: UserEntityPackLiteService,
	) {}

	/**
	 * `DriveFile.properties`を整形する。
	 *
	 * `DriveFile.properties.orientation`（画像の向き）が5以上だった場合、画像のwidthとheightが交換される。
	 * 交換の際、引数として渡した`file`は書き換えられない（immutable）。
	 *
	 * @param file
	 * @returns
	 */
	private getPublicProperties(
		file: DriveFile,
	): z.infer<typeof DriveFilePropertiesSchema> {
		const properties = DriveFilePropertiesSchema.parse(file.properties);

		if (properties.orientation === undefined) return properties;

		const properties_ = deepClone(properties);
		if (properties.orientation >= 5) {
			[properties_.width, properties_.height] = [
				properties_.height,
				properties_.width,
			];
		}
		properties_.orientation = undefined;
		return properties_;
	}

	/**
	 * ファイルのサムネイル表示用URLを得る。
	 *
	 * @param file
	 * @returns 動画でも画像でもなかった場合などは`null`が返される。
	 */
	private getThumbnailUrl(file: DriveFile): string | null {
		// 動画ファイル
		if (file.type.startsWith('video')) {
			if (file.thumbnailUrl) return file.thumbnailUrl;
			return this.videoProcessingService.getExternalVideoThumbnailUrl(
				file.webpublicUrl ?? file.url,
			);
		}

		// リモートのファイル && 外部のメディアプロキシを経由する設定になっている
		if (
			file.uri !== null &&
			file.userHost !== null &&
			this.configLoaderService.data.externalMediaProxyEnabled
		) {
			return this.driveFileProxiedUrlGenerationService.generate(
				file.uri,
				'static',
			);
		}

		// リモートのファイル && 期限切れにより`isLink`が`true`になっている && リモートファイルをプロキシする設定になっている
		if (
			file.uri !== null &&
			file.isLink &&
			this.configLoaderService.data.proxyRemoteFiles
		) {
			// 従来は`/files/${thumbnailAccessKey}`にアクセスしていたが、`/files`はメディアプロキシにリダイレクトするようにしたため直接メディアプロキシを指定する
			return this.driveFileProxiedUrlGenerationService.generate(
				file.uri,
				'static',
			);
		}

		if (file.thumbnailUrl !== null) {
			return file.thumbnailUrl;
		}

		if (isMimeImage(file.type, 'sharp-convertible-image')) {
			return file.webpublicUrl ?? file.url;
		}

		return null;
	}

	/**
	 * `DriveFile`をpackする。
	 *
	 * @param src
	 * @param options.detail   `true`だった場合、返り値に`folder`が含まれるようになる場合がある。含まれる場合、それは再帰的に親フォルダを解決する。
	 * @param options.self     ?
	 * @param options.withUser `true`だった場合、返り値に`user`が含まれるようになる場合がある。
	 * @returns
	 */
	public async pack(
		src: DriveFile['id'] | DriveFile,
		options?: PackOptions,
	): Promise<z.infer<typeof DriveFileSchema>> {
		const opts = {
			detail: false,
			self: false,
			...options,
		};

		const file = await this.prismaService.client.driveFile.findUniqueOrThrow({
			where: { id: typeof src === 'string' ? src : src.id },
			include: { user: true },
		});
		if (file.user === null) throw new Error('file.user is null');

		const [folder, user] = await Promise.all([
			opts.detail && file.folderId
				? this.driveFolderEntityService.pack(file.folderId, { detail: true })
				: null,
			opts.withUser && file.userId
				? this.userEntityPackLiteService.packLite(file.user)
				: null,
		]);

		return {
			id: file.id,
			createdAt: file.createdAt.toISOString(),
			name: file.name,
			type: file.type,
			md5: file.md5,
			size: file.size,
			isSensitive: file.isSensitive,
			blurhash: file.blurhash,
			properties: opts.self
				? DriveFilePropertiesSchema.parse(file.properties)
				: this.getPublicProperties(file),
			url: opts.self
				? file.url
				: this.driveFilePublicUrlGenerationService.generate(file),
			thumbnailUrl: this.getThumbnailUrl(file),
			comment: file.comment,
			folderId: file.folderId,
			folder,
			userId: opts.withUser ? file.userId : null,
			user,
		};
	}

	/**
	 * 複数の`DriveFile`を並列でpackする。
	 *
	 * @param files   ファイルの配列。IDの配列ではない。
	 * @param options
	 * @returns
	 */
	public async packMany(
		files: DriveFile[],
		options?: PackOptions,
	): Promise<z.infer<typeof DriveFileSchema>[]> {
		return await Promise.all(files.map((f) => this.pack(f, options)));
	}

	/**
	 * IDによって指定された複数の`DriveFile`を並列でpackし、IDとpack結果の`Map`として返す。
	 * `fileIds`として渡された`DriveFile`のIDがデータベースに存在しなかった場合、それは`null`として`Map`に含められる。
	 *
	 * @param fileIds
	 * @param options
	 * @returns
	 */
	public async packManyByIdsMap(
		fileIds: DriveFile['id'][],
		options?: PackOptions,
	): Promise<
		Map<
			z.infer<typeof DriveFileSchema>['id'],
			z.infer<typeof DriveFileSchema> | null
		>
	> {
		if (fileIds.length === 0) return new Map();

		const files = await this.prismaService.client.driveFile.findMany({
			where: { id: { in: fileIds } },
		});
		const packedFiles = await this.packMany(files, options);
		const map = new Map<
			z.infer<typeof DriveFileSchema>['id'],
			z.infer<typeof DriveFileSchema> | null
		>(packedFiles.map((f) => [f.id, f]));

		for (const id of fileIds) {
			// データベースに`id`で指定される`DriveFile`が存在しなかった場合、`null`をセットする。
			if (!map.has(id)) map.set(id, null);
		}

		return map;
	}

	/**
	 * IDによって指定された複数の`DriveFile`を並列でpackする。
	 * IDで指定された`DriveFile`がデータベースに存在しなかった場合、それは返り値から除かれる。そのため返り値の要素数は`fileIds`の要素数と異なる場合がある。
	 *
	 * @param fileIds
	 * @param options
	 * @returns
	 */
	public async packManyByIds(
		fileIds: DriveFile['id'][],
		options?: PackOptions,
	): Promise<z.infer<typeof DriveFileSchema>[]> {
		if (fileIds.length === 0) return [];
		const filesMap = await this.packManyByIdsMap(fileIds, options);
		return fileIds.map((id) => filesMap.get(id)).filter(isNotNull);
	}
}
