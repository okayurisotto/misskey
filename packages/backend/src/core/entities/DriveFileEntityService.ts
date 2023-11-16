import { forwardRef, Inject, Injectable } from '@nestjs/common';
import { z } from 'zod';
import { appendQuery, query } from '@/misc/prelude/url.js';
import { deepClone } from '@/misc/clone.js';
import type { DriveFileSchema } from '@/models/zod/DriveFileSchema.js';
import { bindThis } from '@/decorators.js';
import { isMimeImage } from '@/misc/is-mime-image.js';
import { isNotNull } from '@/misc/is-not-null.js';
import { PrismaService } from '@/core/PrismaService.js';
import { ConfigLoaderService } from '@/ConfigLoaderService.js';
import { UtilityService } from '../UtilityService.js';
import { VideoProcessingService } from '../VideoProcessingService.js';
import { UserEntityService } from './UserEntityService.js';
import { DriveFolderEntityService } from './DriveFolderEntityService.js';
import type { drive_file, user } from '@prisma/client';

type PackOptions = {
	detail?: boolean,
	self?: boolean,
	withUser?: boolean,
};

const DriveFilePropertiesSchema = z.object({
	width: z.number().optional(),
	height: z.number().optional(),
	orientation: z.number().optional(),
	avgColor: z.string().optional(),
});

@Injectable()
export class DriveFileEntityService {
	constructor(
		private readonly configLoaderService: ConfigLoaderService,

		// 循環参照のため / for circular dependency
		@Inject(forwardRef(() => UserEntityService))
		private readonly userEntityService: UserEntityService,

		private readonly utilityService: UtilityService,
		private readonly driveFolderEntityService: DriveFolderEntityService,
		private readonly videoProcessingService: VideoProcessingService,
		private readonly prismaService: PrismaService,
	) {}

	/**
	 * `name`として渡された文字列がファイル名として妥当かどうか判定する。
	 *
	 * @param name ファイル名
	 * @returns
	 */
	@bindThis
	public validateFileName(name: string): boolean {
		if (name.trim().length === 0) return false;
		if (name.length > 200) return false;
		if (name.includes('\\')) return false;
		if (name.includes('/')) return false;
		if (name.includes('..')) return false;

		return true;
	}

	/**
	 * `drive_file.properties`を整形する。
	 *
	 * `drive_file.properties.orientation`（画像の向き）が5以上だった場合、画像のwidthとheightが交換される。
	 * 交換の際、引数として渡した`file`は書き換えられない（immutable）。
	 *
	 * @param file
	 * @returns
	 */
	@bindThis
	public getPublicProperties(file: drive_file): z.infer<typeof DriveFilePropertiesSchema> {
		const properties = DriveFilePropertiesSchema.parse(file.properties);

		if (properties.orientation === undefined) return properties;

		const properties_ = deepClone(properties);
		if (properties.orientation >= 5) {
			[properties_.width, properties_.height] = [properties_.height, properties_.width];
		}
		properties_.orientation = undefined;
		return properties_;
	}

	/**
	 * mediaProxy経由のURLに変換する。
	 *
	 * @example `https://media-proxy.example.com/${mode}.webp?url=${url}&${mode}=1`
	 *
	 * @param url
	 * @param mode
	 * @returns
	 */
	@bindThis
	private getProxiedUrl(url: string, mode?: 'static' | 'avatar'): string {
		return appendQuery(
			`${this.configLoaderService.data.mediaProxy}/${mode ?? 'image'}.webp`,
			query({
				url,
				...(mode ? { [mode]: '1' } : {}),
			}),
		);
	}

	/**
	 * ファイルのサムネイル表示用URLを得る。
	 *
	 * @param file
	 * @returns 動画でも画像でもなかった場合などは`null`が返される。
	 */
	@bindThis
	public getThumbnailUrl(file: drive_file): string | null {
		// 動画ファイル
		if (file.type.startsWith('video')) {
			if (file.thumbnailUrl) return file.thumbnailUrl;
			return this.videoProcessingService.getExternalVideoThumbnailUrl(file.webpublicUrl ?? file.url);
		}

		// リモートのファイル && 外部のメディアプロキシを経由する設定になっている
		if (file.uri !== null && file.userHost !== null && this.configLoaderService.data.externalMediaProxyEnabled) {
			return this.getProxiedUrl(file.uri, 'static');
		}

		// リモートのファイル && 期限切れにより`isLink`が`true`になっている && リモートファイルをプロキシする設定になっている
		if (file.uri !== null && file.isLink && this.configLoaderService.data.proxyRemoteFiles) {
			// 従来は`/files/${thumbnailAccessKey}`にアクセスしていたが、`/files`はメディアプロキシにリダイレクトするようにしたため直接メディアプロキシを指定する
			return this.getProxiedUrl(file.uri, 'static');
		}

		if (file.thumbnailUrl !== null) {
			return file.thumbnailUrl;
		}

		if (isMimeImage(file.type, 'sharp-convertible-image')) {
			return file.webpublicUrl ?? file.url;
		}

		return null;
	}

	@bindThis
	public getPublicUrl(file: drive_file, mode?: 'avatar'): string {
		// リモートのファイル && 外部のメディアプロキシを経由する設定になっている
		if (file.uri !== null && file.userHost !== null && this.configLoaderService.data.externalMediaProxyEnabled) {
			return this.getProxiedUrl(file.uri, mode);
		}

		// リモートのファイル && 期限切れにより`isLink`が`true`になっている && リモートファイルをプロキシする設定になっている
		if (file.uri != null && file.isLink && this.configLoaderService.data.proxyRemoteFiles) {
			const key = file.webpublicAccessKey;

			// 古いものは`key`にオブジェクトストレージキーが入ってしまっているので除外する
			if (key && !key.includes('/')) {
				const url = `${this.configLoaderService.data.url}/files/${key}`; // TODO: 直接メディアプロキシを指定しても問題ないはず？
				if (mode === 'avatar') return this.getProxiedUrl(file.uri, 'avatar');
				return url;
			}
		}

		const url = file.webpublicUrl ?? file.url;

		if (mode === 'avatar') {
			return this.getProxiedUrl(url, 'avatar');
		}
		return url;
	}

	/**
	 * 指定されたユーザーによるファイルの合計サイズを計算する。
	 *
	 * @param user
	 * @returns
	 */
	@bindThis
	public async calcDriveUsageOf(user: user['id'] | { id: user['id'] }): Promise<number> {
		const id = typeof user === 'object' ? user.id : user;

		const { _sum: { size } } = await this.prismaService.client.drive_file.aggregate({
			where: { userId: id, isLink: false },
			_sum: { size: true }
		});

		return size ?? 0;
	}

	/**
	 * `host`によって指定されたインスタンスのユーザーによるファイルの合計サイズを計算する。
	 * `isLink`が`false`になっている（期限が切れている）ファイルのサイズは含まれない。
	 *
	 * @param host
	 * @returns
	 */
	@bindThis
	public async calcDriveUsageOfHost(host: string): Promise<number> {
		const { _sum: { size } } = await this.prismaService.client.drive_file.aggregate({
			where: {
				userHost: this.utilityService.toPuny(host),
				isLink: false,
			},
			_sum: { size: true },
		})

		return size ?? 0;
	}

	/**
	 * このインスタンスのユーザーによるファイルの合計サイズを計算する。
	 *
	 * @returns
	 */
	@bindThis
	public async calcDriveUsageOfLocal(): Promise<number> {
		const { _sum: { size } } = await this.prismaService.client.drive_file.aggregate({
			where: {
				userHost: null,
				isLink: false,
			},
			_sum: { size: true },
		});

		return size ?? 0;
	}

	/**
	 * すべてのリモートのインスタンスのユーザーによるファイルの合計サイズを計算する。
	 *
	 * @returns
	 */
	@bindThis
	public async calcDriveUsageOfRemote(): Promise<number> {
		const { _sum: { size } } = await this.prismaService.client.drive_file.aggregate({
			where: {
				userHost: { not: null },
				isLink: false,
			},
			_sum: { size: true },
		});

		return size ?? 0;
	}

	/**
	 * `drive_file`をpackする。
	 *
	 * @param src
	 * @param options.detail   `true`だった場合、返り値に`folder`が含まれるようになる場合がある。含まれる場合、それは再帰的に親フォルダを解決する。
	 * @param options.self     ?
	 * @param options.withUser `true`だった場合、返り値に`user`が含まれるようになる場合がある。
	 * @returns
	 */
	@bindThis
	public async pack(
		src: drive_file['id'] | drive_file,
		options?: PackOptions,
	): Promise<z.infer<typeof DriveFileSchema>> {
		const opts = {
			detail: false,
			self: false,
			...options,
		};

		const file = await this.prismaService.client.drive_file.findUniqueOrThrow({
			where: { id: typeof src === 'string' ? src : src.id },
			include: { user_drive_file_userIdTouser: true },
		});
		if (file.user_drive_file_userIdTouser === null) throw new Error('file.user_drive_file_userIdTouser is null');

		const [folder, user] = await Promise.all([
			opts.detail && file.folderId
				? this.driveFolderEntityService.pack(file.folderId, { detail: true })
				: null,
			opts.withUser && file.userId
				? this.userEntityService.packLite(file.user_drive_file_userIdTouser)
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
			url: opts.self ? file.url : this.getPublicUrl(file),
			thumbnailUrl: this.getThumbnailUrl(file),
			comment: file.comment,
			folderId: file.folderId,
			folder,
			userId: opts.withUser ? file.userId : null,
			user,
		};
	}

	/**
	 * 複数の`drive_file`を並列でpackする。
	 *
	 * @param files   ファイルの配列。IDの配列ではない。
	 * @param options
	 * @returns
	 */
	@bindThis
	public async packMany(
		files: drive_file[],
		options?: PackOptions,
	): Promise<z.infer<typeof DriveFileSchema>[]> {
		return await Promise.all(files.map(f => this.pack(f, options)));
	}

	/**
	 * IDによって指定された複数の`drive_file`を並列でpackし、IDとpack結果の`Map`として返す。
	 * `fileIds`として渡された`drive_file`のIDがデータベースに存在しなかった場合、それは`null`として`Map`に含められる。
	 *
	 * @param fileIds
	 * @param options
	 * @returns
	 */
	@bindThis
	public async packManyByIdsMap(
		fileIds: drive_file['id'][],
		options?: PackOptions,
	): Promise<Map<z.infer<typeof DriveFileSchema>['id'], z.infer<typeof DriveFileSchema> | null>> {
		if (fileIds.length === 0) return new Map();

		const files = await this.prismaService.client.drive_file.findMany({ where: { id: { in: fileIds } } });
		const packedFiles = await this.packMany(files, options);
		const map = new Map<z.infer<typeof DriveFileSchema>['id'], z.infer<typeof DriveFileSchema> | null>(packedFiles.map(f => [f.id, f]));

		for (const id of fileIds) {
			// データベースに`id`で指定される`drive_file`が存在しなかった場合、`null`をセットする。
			if (!map.has(id)) map.set(id, null);
		}

		return map;
	}

	/**
	 * IDによって指定された複数の`drive_file`を並列でpackする。
	 * IDで指定された`drive_file`がデータベースに存在しなかった場合、それは返り値から除かれる。そのため返り値の要素数は`fileIds`の要素数と異なる場合がある。
	 *
	 * @param fileIds
	 * @param options
	 * @returns
	 */
	@bindThis
	public async packManyByIds(
		fileIds: drive_file['id'][],
		options?: PackOptions,
	): Promise<z.infer<typeof DriveFileSchema>[]> {
		if (fileIds.length === 0) return [];
		const filesMap = await this.packManyByIdsMap(fileIds, options);
		return fileIds.map(id => filesMap.get(id)).filter(isNotNull);
	}
}
