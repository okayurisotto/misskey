import { randomUUID } from 'node:crypto';
import * as fs from 'node:fs';
import { Injectable } from '@nestjs/common';
import sharp from 'sharp';
import { sharpBmp } from 'sharp-read-bmp';
import { PutObjectCommandInput } from '@aws-sdk/client-s3';
import { z } from 'zod';
import Logger from '@/misc/logger.js';
import { MetaService } from '@/core/MetaService.js';
import { FILE_TYPE_BROWSERSAFE } from '@/const.js';
import { contentDisposition } from '@/misc/content-disposition.js';
import { VideoProcessingService } from '@/core/VideoProcessingService.js';
import { ImageProcessingService } from '@/core/ImageProcessingService.js';
import type { IImage } from '@/core/ImageProcessingService.js';
import { S3Service } from '@/core/S3Service.js';
import { InternalStorageService } from '@/core/InternalStorageService.js';
import { correctFilename } from '@/misc/correct-filename.js';
import { isMimeImage } from '@/misc/is-mime-image.js';
import { PrismaService } from '@/core/PrismaService.js';
import { ConfigLoaderService } from '@/ConfigLoaderService.js';
import type { DriveFile } from '@prisma/client';

const FilePropertiesSchema = z.object({
	width: z.number().optional(),
	height: z.number().optional(),
	orientation: z.number().optional(),
	avgColor: z.string().optional(),
});

@Injectable()
export class DriveFileSaveService {
	private readonly registerLogger: Logger;

	constructor(
		private readonly configLoaderService: ConfigLoaderService,
		private readonly imageProcessingService: ImageProcessingService,
		private readonly internalStorageService: InternalStorageService,
		private readonly metaService: MetaService,
		private readonly prismaService: PrismaService,
		private readonly s3Service: S3Service,
		private readonly videoProcessingService: VideoProcessingService,
	) {
		const logger = new Logger('drive', 'blue');
		this.registerLogger = logger.createSubLogger('register', 'yellow');
	}

	/***
	 * Save file
	 * @param path Path for original
	 * @param name Name for original (should be extention corrected)
	 * @param type Content-Type for original
	 * @param hash Hash for original
	 * @param size Size for original
	 */
	public async save(
		file: Omit<DriveFile, 'properties' | 'requestHeaders'> & {
			properties: {
				width?: number;
				height?: number;
				orientation?: number;
				avgColor?: string;
			};
			requestHeaders: Record<string, string> | null;
		},
		path: string,
		name: string,
		type: string,
		hash: string,
		size: number,
	): Promise<
		Omit<DriveFile, 'properties' | 'requestHeaders'> & {
			properties: {
				width?: number;
				height?: number;
				orientation?: number;
				avgColor?: string;
			};
			requestHeaders: Record<string, string> | null;
		}
	> {
		// thunbnail, webpublic を必要なら生成
		const alts = await this.generateAlts(path, type, !file.uri);

		const meta = await this.metaService.fetch();

		if (meta.useObjectStorage) {
			//#region ObjectStorage params
			let [ext] = name.match(/\.([a-zA-Z0-9_-]+)$/) ?? [''];

			if (ext === '') {
				if (type === 'image/jpeg') ext = '.jpg';
				if (type === 'image/png') ext = '.png';
				if (type === 'image/webp') ext = '.webp';
				if (type === 'image/avif') ext = '.avif';
				if (type === 'image/apng') ext = '.apng';
				if (type === 'image/vnd.mozilla.apng') ext = '.apng';
			}

			// 拡張子からContent-Typeを設定してそうな挙動を示すオブジェクトストレージ (upcloud?) も存在するので、
			// 許可されているファイル形式でしかURLに拡張子をつけない
			if (!FILE_TYPE_BROWSERSAFE.includes(type)) {
				ext = '';
			}

			const baseUrl =
				meta.objectStorageBaseUrl ??
				`${meta.objectStorageUseSSL ? 'https' : 'http'}://${
					meta.objectStorageEndpoint
				}${meta.objectStoragePort ? `:${meta.objectStoragePort}` : ''}/${
					meta.objectStorageBucket
				}`;

			// for original
			const key = `${meta.objectStoragePrefix}/${randomUUID()}${ext}`;
			const url = `${baseUrl}/${key}`;

			// for alts
			let webpublicKey: string | null = null;
			let webpublicUrl: string | null = null;
			let thumbnailKey: string | null = null;
			let thumbnailUrl: string | null = null;
			//#endregion

			//#region Uploads
			this.registerLogger.info(`uploading original: ${key}`);
			const uploads = [
				this.upload(key, fs.createReadStream(path), type, null, name),
			];

			if (alts.webpublic) {
				webpublicKey = `${meta.objectStoragePrefix}/webpublic-${randomUUID()}.${
					alts.webpublic.ext
				}`;
				webpublicUrl = `${baseUrl}/${webpublicKey}`;

				this.registerLogger.info(`uploading webpublic: ${webpublicKey}`);
				uploads.push(
					this.upload(
						webpublicKey,
						alts.webpublic.data,
						alts.webpublic.type,
						alts.webpublic.ext,
						name,
					),
				);
			}

			if (alts.thumbnail) {
				thumbnailKey = `${meta.objectStoragePrefix}/thumbnail-${randomUUID()}.${
					alts.thumbnail.ext
				}`;
				thumbnailUrl = `${baseUrl}/${thumbnailKey}`;

				this.registerLogger.info(`uploading thumbnail: ${thumbnailKey}`);
				uploads.push(
					this.upload(
						thumbnailKey,
						alts.thumbnail.data,
						alts.thumbnail.type,
						alts.thumbnail.ext,
						`${name}.thumbnail`,
					),
				);
			}

			await Promise.all(uploads);
			//#endregion

			file.url = url;
			file.thumbnailUrl = thumbnailUrl;
			file.webpublicUrl = webpublicUrl;
			file.accessKey = key;
			file.thumbnailAccessKey = thumbnailKey;
			file.webpublicAccessKey = webpublicKey;
			file.webpublicType = alts.webpublic?.type ?? null;
			file.name = name;
			file.type = type;
			file.md5 = hash;
			file.size = size;
			file.storedInternal = false;

			const result = await this.prismaService.client.driveFile.create({
				data: {
					...file,
					requestHeaders: file.requestHeaders ?? undefined,
				},
			});
			return {
				...result,
				properties: FilePropertiesSchema.parse(result.properties),
				requestHeaders: z
					.record(z.string(), z.string())
					.nullable()
					.parse(result.requestHeaders),
			};
		} else {
			// use internal storage
			const accessKey = randomUUID();
			const thumbnailAccessKey = 'thumbnail-' + randomUUID();
			const webpublicAccessKey = 'webpublic-' + randomUUID();

			const url = this.internalStorageService.saveFromPath(accessKey, path);

			let thumbnailUrl: string | null = null;
			let webpublicUrl: string | null = null;

			if (alts.thumbnail) {
				thumbnailUrl = this.internalStorageService.saveFromBuffer(
					thumbnailAccessKey,
					alts.thumbnail.data,
				);
				this.registerLogger.info(`thumbnail stored: ${thumbnailAccessKey}`);
			}

			if (alts.webpublic) {
				webpublicUrl = this.internalStorageService.saveFromBuffer(
					webpublicAccessKey,
					alts.webpublic.data,
				);
				this.registerLogger.info(`web stored: ${webpublicAccessKey}`);
			}

			file.storedInternal = true;
			file.url = url;
			file.thumbnailUrl = thumbnailUrl;
			file.webpublicUrl = webpublicUrl;
			file.accessKey = accessKey;
			file.thumbnailAccessKey = thumbnailAccessKey;
			file.webpublicAccessKey = webpublicAccessKey;
			file.webpublicType = alts.webpublic?.type ?? null;
			file.name = name;
			file.type = type;
			file.md5 = hash;
			file.size = size;

			const result = await this.prismaService.client.driveFile.create({
				data: {
					...file,
					requestHeaders: file.requestHeaders ?? undefined,
				},
			});
			return {
				...result,
				properties: FilePropertiesSchema.parse(result.properties),
				requestHeaders: z
					.record(z.string(), z.string())
					.nullable()
					.parse(result.requestHeaders),
			};
		}
	}

	/**
	 * Generate webpublic, thumbnail, etc
	 * @param path Path for original
	 * @param type Content-Type for original
	 * @param generateWeb Generate webpublic or not
	 */
	private async generateAlts(
		path: string,
		type: string,
		generateWeb: boolean,
	): Promise<{ webpublic: IImage | null; thumbnail: IImage | null }> {
		if (type.startsWith('video/')) {
			if (this.configLoaderService.data.videoThumbnailGenerator !== null) {
				// videoThumbnailGeneratorが指定されていたら動画サムネイル生成はスキップ
				return {
					webpublic: null,
					thumbnail: null,
				};
			}

			try {
				const thumbnail =
					await this.videoProcessingService.generateVideoThumbnail(path);
				return {
					webpublic: null,
					thumbnail,
				};
			} catch (err) {
				this.registerLogger.warn(`GenerateVideoThumbnail failed: ${err}`);
				return {
					webpublic: null,
					thumbnail: null,
				};
			}
		}

		if (!isMimeImage(type, 'sharp-convertible-image-with-bmp')) {
			this.registerLogger.debug(
				'web image and thumbnail not created (cannot convert by sharp)',
			);
			return {
				webpublic: null,
				thumbnail: null,
			};
		}

		let img: sharp.Sharp | null = null;
		let satisfyWebpublic: boolean;
		let isAnimated: boolean;

		try {
			img = await sharpBmp(path, type);
			const metadata = await img.metadata();
			isAnimated = !!(metadata.pages && metadata.pages > 1);

			satisfyWebpublic = !!(
				type !== 'image/svg+xml' && // security reason
				type !== 'image/avif' && // not supported by Mastodon and MS Edge
				!(
					metadata.exif ??
					metadata.iptc ??
					metadata.xmp ??
					metadata.tifftagPhotoshop
				) &&
				metadata.width &&
				metadata.width <= 2048 &&
				metadata.height &&
				metadata.height <= 2048
			);
		} catch (err) {
			this.registerLogger.warn(`sharp failed: ${err}`);
			return {
				webpublic: null,
				thumbnail: null,
			};
		}

		// #region webpublic
		let webpublic: IImage | null = null;

		if (generateWeb && !satisfyWebpublic && !isAnimated) {
			this.registerLogger.info('creating web image');

			try {
				if (['image/jpeg', 'image/webp', 'image/avif'].includes(type)) {
					webpublic = await this.imageProcessingService.convertSharpToWebp(
						img,
						2048,
						2048,
					);
				} else if (['image/png', 'image/bmp', 'image/svg+xml'].includes(type)) {
					webpublic = await this.imageProcessingService.convertSharpToPng(
						img,
						2048,
						2048,
					);
				} else {
					this.registerLogger.debug(
						'web image not created (not an required image)',
					);
				}
			} catch (err) {
				this.registerLogger.warn('web image not created (an error occured)');
			}
		} else {
			if (satisfyWebpublic)
				this.registerLogger.info(
					'web image not created (original satisfies webpublic)',
				);
			else if (isAnimated)
				this.registerLogger.info('web image not created (animated image)');
			else this.registerLogger.info('web image not created (from remote)');
		}
		// #endregion webpublic

		// #region thumbnail
		let thumbnail: IImage | null = null;

		try {
			if (isAnimated) {
				thumbnail = await this.imageProcessingService.convertSharpToWebp(
					sharp(path, { animated: true }),
					374,
					317,
					{ alphaQuality: 70 },
				);
			} else {
				thumbnail = await this.imageProcessingService.convertSharpToWebp(
					img,
					498,
					422,
				);
			}
		} catch (err) {
			this.registerLogger.warn('thumbnail not created (an error occured)');
		}
		// #endregion thumbnail

		return {
			webpublic,
			thumbnail,
		};
	}

	/**
	 * Upload to ObjectStorage
	 */
	private async upload(
		key: string,
		stream: fs.ReadStream | Buffer,
		type_: string,
		ext?: string | null,
		filename?: string,
	): Promise<void> {
		const type = ((): string => {
			if (type_ === 'image/apng') return 'image/png';
			if (FILE_TYPE_BROWSERSAFE.includes(type_)) return type_;
			return 'application/octet-stream';
		})();

		const meta = await this.metaService.fetch();

		const params: PutObjectCommandInput = {
			Bucket: meta.objectStorageBucket ?? undefined,
			Key: key,
			Body: stream,
			ContentType: type,
			CacheControl: 'max-age=31536000, immutable',
		};

		if (filename)
			params.ContentDisposition = contentDisposition(
				'inline',
				// 拡張子からContent-Typeを設定してそうな挙動を示すオブジェクトストレージ (upcloud?) も存在するので、
				// 許可されているファイル形式でしか拡張子をつけない
				ext ? correctFilename(filename, ext) : filename,
			);
		if (meta.objectStorageSetPublicRead) params.ACL = 'public-read';

		await this.s3Service
			.upload(meta, params)
			.then((result) => {
				if ('Bucket' in result) {
					// CompleteMultipartUploadCommandOutput
					this.registerLogger.debug(
						`Uploaded: ${result.Bucket}/${result.Key} => ${result.Location}`,
					);
				} else {
					// AbortMultipartUploadCommandOutput
					this.registerLogger.error(
						`Upload Result Aborted: key = ${key}, filename = ${filename}`,
					);
				}
			})
			.catch((err) => {
				this.registerLogger.error(
					`Upload Failed: key = ${key}, filename = ${filename}`,
					err,
				);
			});
	}
}
