import { forwardRef, Inject, Injectable } from '@nestjs/common';
import { z } from 'zod';
import { DI } from '@/di-symbols.js';
import type { Config } from '@/config.js';
import { awaitAll } from '@/misc/prelude/await-all.js';
import { appendQuery, query } from '@/misc/prelude/url.js';
import { deepClone } from '@/misc/clone.js';
import type { DriveFileSchema } from '@/models/zod/DriveFileSchema.js';
import { bindThis } from '@/decorators.js';
import { isMimeImage } from '@/misc/is-mime-image.js';
import { isNotNull } from '@/misc/is-not-null.js';
import { PrismaService } from '@/core/PrismaService.js';
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

@Injectable()
export class DriveFileEntityService {
	constructor(
		@Inject(DI.config)
		private readonly config: Config,

		// 循環参照のため / for circular dependency
		@Inject(forwardRef(() => UserEntityService))
		private readonly userEntityService: UserEntityService,

		private readonly utilityService: UtilityService,
		private readonly driveFolderEntityService: DriveFolderEntityService,
		private readonly videoProcessingService: VideoProcessingService,
		private readonly prismaService: PrismaService,
	) {}

	@bindThis
	public validateFileName(name: string): boolean {
		return (
			(name.trim().length > 0) &&
			(name.length <= 200) &&
			(name.indexOf('\\') === -1) &&
			(name.indexOf('/') === -1) &&
			(name.indexOf('..') === -1)
		);
	}

	@bindThis
	public getPublicProperties(file: drive_file) {
		const properties_ = z.object({
			width: z.number().optional(),
			height: z.number().optional(),
			orientation: z.number().optional(),
			avgColor: z.string().optional(),
		}).parse(file.properties);

		if (properties_.orientation != null) {
			const properties = deepClone(properties_);
			if (properties_.orientation >= 5) {
				[properties.width, properties.height] = [properties.height, properties.width];
			}
			properties.orientation = undefined;
			return properties;
		}

		return properties_;
	}

	@bindThis
	private getProxiedUrl(url: string, mode?: 'static' | 'avatar'): string {
		return appendQuery(
			`${this.config.mediaProxy}/${mode ?? 'image'}.webp`,
			query({
				url,
				...(mode ? { [mode]: '1' } : {}),
			}),
		);
	}

	@bindThis
	public getThumbnailUrl(file: drive_file): string | null {
		if (file.type.startsWith('video')) {
			if (file.thumbnailUrl) return file.thumbnailUrl;

			return this.videoProcessingService.getExternalVideoThumbnailUrl(file.webpublicUrl ?? file.url ?? file.uri);
		} else if (file.uri != null && file.userHost != null && this.config.externalMediaProxyEnabled) {
			// 動画ではなくリモートかつメディアプロキシ
			return this.getProxiedUrl(file.uri, 'static');
		}

		if (file.uri != null && file.isLink && this.config.proxyRemoteFiles) {
			// リモートかつ期限切れはローカルプロキシを試みる
			// 従来は/files/${thumbnailAccessKey}にアクセスしていたが、
			// /filesはメディアプロキシにリダイレクトするようにしたため直接メディアプロキシを指定する
			return this.getProxiedUrl(file.uri, 'static');
		}

		const url = file.webpublicUrl ?? file.url;

		return file.thumbnailUrl ?? (isMimeImage(file.type, 'sharp-convertible-image') ? url : null);
	}

	@bindThis
	public getPublicUrl(file: drive_file, mode?: 'avatar'): string { // static = thumbnail
		// リモートかつメディアプロキシ
		if (file.uri != null && file.userHost != null && this.config.externalMediaProxyEnabled) {
			return this.getProxiedUrl(file.uri, mode);
		}

		// リモートかつ期限切れはローカルプロキシを試みる
		if (file.uri != null && file.isLink && this.config.proxyRemoteFiles) {
			const key = file.webpublicAccessKey;

			if (key && !key.match('/')) {	// 古いものはここにオブジェクトストレージキーが入ってるので除外
				const url = `${this.config.url}/files/${key}`;
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

	@bindThis
	public async calcDriveUsageOf(user: user['id'] | { id: user['id'] }): Promise<number> {
		const id = typeof user === 'object' ? user.id : user;

		const { _sum: { size } } = await this.prismaService.client.drive_file.aggregate({
			where: { userId: id, isLink: false },
			_sum: { size: true }
		});

		return size ?? 0;
	}

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

	@bindThis
	public async pack(
		src: drive_file['id'] | drive_file,
		options?: PackOptions,
	): Promise<z.infer<typeof DriveFileSchema>> {
		const opts = Object.assign({
			detail: false,
			self: false,
		}, options);

		const file = typeof src === 'object'
			? src
			: await this.prismaService.client.drive_file.findUniqueOrThrow({ where: { id: src } });

		const result = await awaitAll({
			folder: () =>
				opts.detail && file.folderId
					? this.driveFolderEntityService.pack(file.folderId, { detail: true })
					: Promise.resolve(null),
			user: () =>
				opts.withUser && file.userId
					? this.userEntityService.pack(file.userId)
					: Promise.resolve(null),
		});

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
				? z.object({
						width: z.number().optional(),
						height: z.number().optional(),
						orientation: z.number().optional(),
						avgColor: z.string().optional(),
					}).parse(file.properties)
				: this.getPublicProperties(file),
			url: opts.self ? file.url : this.getPublicUrl(file),
			thumbnailUrl: this.getThumbnailUrl(file),
			comment: file.comment,
			folderId: file.folderId,
			folder: result.folder,
			userId: opts.withUser ? file.userId : null,
			user: result.user,
		};
	}

	@bindThis
	public async packNullable(
		src: drive_file['id'] | drive_file,
		options?: PackOptions,
	): Promise<z.infer<typeof DriveFileSchema> | null> {
		const opts = Object.assign({
			detail: false,
			self: false,
		}, options);

		const file = typeof src === 'object'
			? src
			: await this.prismaService.client.drive_file.findUnique({ where: { id: src } });
		if (file == null) return null;

		const result = await awaitAll({
			folder: () =>
				opts.detail && file.folderId
					? this.driveFolderEntityService.pack(file.folderId, { detail: true })
					: Promise.resolve(null),
			user: () =>
				opts.withUser && file.userId
					? this.userEntityService.pack(file.userId)
					: Promise.resolve(null),
		});

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
				? z.object({
						width: z.number().optional(),
						height: z.number().optional(),
						orientation: z.number().optional(),
						avgColor: z.string().optional(),
					}).parse(file.properties)
				: this.getPublicProperties(file),
			url: opts.self ? file.url : this.getPublicUrl(file),
			thumbnailUrl: this.getThumbnailUrl(file),
			comment: file.comment,
			folderId: file.folderId,
			folder: result.folder,
			userId: opts.withUser ? file.userId : null,
			user: result.user,
		};
	}

	@bindThis
	public async packMany(
		files: drive_file[],
		options?: PackOptions,
	): Promise<z.infer<typeof DriveFileSchema>[]> {
		const items = await Promise.all(files.map(f => this.packNullable(f, options)));
		return items.filter((x): x is z.infer<typeof DriveFileSchema> => x != null);
	}

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
			if (!map.has(id)) map.set(id, null);
		}
		return map;
	}

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
