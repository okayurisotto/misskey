import * as fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';
import { Readable } from 'node:stream';
import { Injectable } from '@nestjs/common';
import rename from 'rename';
import sharp from 'sharp';
import { sharpBmp } from 'sharp-read-bmp';
import { createTemp } from '@/misc/create-temp.js';
import { FILE_TYPE_BROWSERSAFE } from '@/const.js';
import { StatusError } from '@/misc/status-error.js';
import Logger from '@/misc/logger.js';
import { DownloadService } from '@/core/DownloadService.js';
import {
	IImageStreamable,
	ImageProcessingService,
	webpDefault,
} from '@/core/ImageProcessingService.js';
import { VideoProcessingService } from '@/core/VideoProcessingService.js';
import { InternalStorageService } from '@/core/InternalStorageService.js';
import { contentDisposition } from '@/misc/content-disposition.js';
import { FileInfoService } from '@/core/FileInfoService.js';
import { isMimeImage } from '@/misc/is-mime-image.js';
import { correctFilename } from '@/misc/correct-filename.js';
import { PrismaService } from '@/core/PrismaService.js';
import { ConfigLoaderService } from '@/ConfigLoaderService.js';
import type {
	FastifyInstance,
	FastifyRequest,
	FastifyReply,
	FastifyPluginOptions,
} from 'fastify';
import type { DriveFile } from '@prisma/client';

const _filename = fileURLToPath(import.meta.url);
const _dirname = dirname(_filename);

/**
 * @deprecated このようなパスは存在しない
 *
 * b75184ec8 によりバグるようになった。
 * 現時点までこのバグが問題になっていないということはデッドコードである可能性が高い。
 */
const ASSETS_DIR = `${_dirname}/../../server/file/assets/`;

@Injectable()
export class FileServerService {
	private readonly logger = new Logger('server', 'gray');

	constructor(
		private readonly configLoaderService: ConfigLoaderService,
		private readonly downloadService: DownloadService,
		private readonly fileInfoService: FileInfoService,
		private readonly imageProcessingService: ImageProcessingService,
		private readonly internalStorageService: InternalStorageService,
		private readonly prismaService: PrismaService,
		private readonly videoProcessingService: VideoProcessingService,
	) {}

	public createServer(
		fastify: FastifyInstance,
		options: FastifyPluginOptions,
		done: (err?: Error) => void,
	): void {
		fastify.addHook('onRequest', (request, reply, done) => {
			reply.header(
				'Content-Security-Policy',
				"default-src 'none'; img-src 'self'; media-src 'self'; style-src 'unsafe-inline'",
			);
			done();
		});

		/**
		 * ?
		 * （Initial commitからある用途不明なファイル）
		 */
		fastify.get('/files/app-default.jpg', (request, reply) => {
			const file = fs.createReadStream(`${_dirname}/assets/dummy.png`);
			reply.header('Content-Type', 'image/jpeg');
			reply.header('Cache-Control', 'max-age=31536000, immutable');
			return reply.send(file);
		});

		fastify.get<{ Params: { key: string } }>(
			'/files/:key',
			async (request, reply) => {
				return await this.sendDriveFile(request, reply).catch((err) =>
					this.errorHandler(request, reply, err),
				);
			},
		);
		fastify.get<{ Params: { key: string } }>(
			'/files/:key/*',
			async (request, reply) => {
				return await this.sendDriveFile(request, reply).catch((err) =>
					this.errorHandler(request, reply, err),
				);
			},
		);

		fastify.get<{
			Params: { url: string };
			Querystring: { url?: string };
		}>('/proxy/:url*', async (request, reply) => {
			return await this.proxyHandler(request, reply).catch((err) =>
				this.errorHandler(request, reply, err),
			);
		});

		done();
	}

	private async errorHandler(
		request: FastifyRequest<{
			Params?: { [x: string]: any };
			Querystring?: { [x: string]: any };
		}>,
		reply: FastifyReply,
		err?: any,
	): Promise<undefined> {
		this.logger.error(`${err}`);

		reply.header('Cache-Control', 'max-age=300');

		if (request.query && 'fallback' in request.query) {
			return reply.sendFile('/dummy.png', ASSETS_DIR);
		}

		if (
			err instanceof StatusError &&
			(err.statusCode === 302 || err.isClientError)
		) {
			reply.code(err.statusCode);
			return;
		}

		reply.code(500);
		return;
	}

	private async sendDriveFile(
		request: FastifyRequest<{ Params: { key: string } }>,
		reply: FastifyReply,
	): Promise<Readable | Buffer | undefined> {
		const key = request.params.key;
		const file = await this.getFileFromKey(key).then();

		if (file === '404') {
			reply.code(404);
			reply.header('Cache-Control', 'max-age=86400');
			return reply.sendFile('/dummy.png', ASSETS_DIR);
		}

		if (file === '204') {
			reply.code(204);
			reply.header('Cache-Control', 'max-age=86400');
			return;
		}

		try {
			if (file.state === 'remote') {
				let image: IImageStreamable | null = null;

				if (file.fileRole === 'thumbnail') {
					if (isMimeImage(file.mime, 'sharp-convertible-image-with-bmp')) {
						reply.header('Cache-Control', 'max-age=31536000, immutable');

						const url = new URL(
							'static.webp',
							this.configLoaderService.data.mediaProxy,
						);
						url.searchParams.set('url', file.url);
						url.searchParams.set('static', '1');

						file.cleanup();
						return await reply.redirect(301, url.toString());
					} else if (file.mime.startsWith('video/')) {
						const externalThumbnail =
							this.videoProcessingService.getExternalVideoThumbnailUrl(
								file.url,
							);
						if (externalThumbnail) {
							file.cleanup();
							return await reply.redirect(301, externalThumbnail);
						}

						image = await this.videoProcessingService.generateVideoThumbnail(
							file.path,
						);
					}
				}

				if (file.fileRole === 'webpublic') {
					if (['image/svg+xml'].includes(file.mime)) {
						reply.header('Cache-Control', 'max-age=31536000, immutable');

						const url = new URL(
							'svg.webp',
							this.configLoaderService.data.mediaProxy,
						);
						url.searchParams.set('url', file.url);

						file.cleanup();
						return await reply.redirect(301, url.toString());
					}
				}

				if (!image) {
					image = {
						data: fs.createReadStream(file.path),
						ext: file.ext,
						type: file.mime,
					};
				}

				if ('pipe' in image.data && typeof image.data.pipe === 'function') {
					// image.dataがstreamなら、stream終了後にcleanup
					image.data.on('end', file.cleanup);
					image.data.on('close', file.cleanup);
				} else {
					// image.dataがstreamでないなら直ちにcleanup
					file.cleanup();
				}

				reply.header(
					'Content-Type',
					FILE_TYPE_BROWSERSAFE.includes(image.type)
						? image.type
						: 'application/octet-stream',
				);
				reply.header(
					'Content-Disposition',
					contentDisposition(
						'inline',
						correctFilename(file.filename, image.ext),
					),
				);
				return image.data;
			}

			if (file.fileRole !== 'original') {
				const filename = rename(file.filename, {
					suffix: file.fileRole === 'thumbnail' ? '-thumb' : '-web',
					extname: file.ext ? `.${file.ext}` : '.unknown',
				}).toString();

				reply.header(
					'Content-Type',
					FILE_TYPE_BROWSERSAFE.includes(file.mime)
						? file.mime
						: 'application/octet-stream',
				);
				reply.header('Cache-Control', 'max-age=31536000, immutable');
				reply.header(
					'Content-Disposition',
					contentDisposition('inline', filename),
				);
				return fs.createReadStream(file.path);
			} else {
				reply.header(
					'Content-Type',
					FILE_TYPE_BROWSERSAFE.includes(file.file.type)
						? file.file.type
						: 'application/octet-stream',
				);
				reply.header('Cache-Control', 'max-age=31536000, immutable');
				reply.header(
					'Content-Disposition',
					contentDisposition('inline', file.filename),
				);
				return fs.createReadStream(file.path);
			}
		} catch (e) {
			if ('cleanup' in file) file.cleanup();
			throw e;
		}
	}

	private async proxyHandler(
		request: FastifyRequest<{
			Params: { url: string };
			Querystring: { url?: string };
		}>,
		reply: FastifyReply,
	): Promise<Readable | Buffer | undefined> {
		const url =
			'url' in request.query
				? request.query.url
				: 'https://' + request.params.url;

		if (typeof url !== 'string') {
			reply.code(400);
			return;
		}

		// アバタークロップなど、どうしてもオリジンである必要がある場合
		const mustOrigin = 'origin' in request.query;

		if (
			this.configLoaderService.data.externalMediaProxyEnabled &&
			!mustOrigin
		) {
			// 外部のメディアプロキシが有効なら、そちらにリダイレクト

			reply.header('Cache-Control', 'public, max-age=259200'); // 3 days

			const url = new URL(
				request.params.url || '',
				this.configLoaderService.data.mediaProxy,
			);

			for (const [key, value] of Object.entries(request.query)) {
				url.searchParams.append(key, value);
			}

			return await reply.redirect(301, url.toString());
		}

		// Create temp file
		const file = await this.getStreamAndTypeFromUrl(url);
		if (file === '404') {
			reply.code(404);
			reply.header('Cache-Control', 'max-age=86400');
			return reply.sendFile('/dummy.png', ASSETS_DIR);
		}

		if (file === '204') {
			reply.code(204);
			reply.header('Cache-Control', 'max-age=86400');
			return;
		}

		try {
			const isConvertibleImage = isMimeImage(
				file.mime,
				'sharp-convertible-image-with-bmp',
			);
			const isAnimationConvertibleImage = isMimeImage(
				file.mime,
				'sharp-animation-convertible-image-with-bmp',
			);

			if (
				'emoji' in request.query ||
				'avatar' in request.query ||
				'static' in request.query ||
				'preview' in request.query ||
				'badge' in request.query
			) {
				if (!isConvertibleImage) {
					// 画像でないなら404でお茶を濁す
					throw new StatusError('Unexpected mime', 404);
				}
			}

			let image: IImageStreamable | null = null;
			if ('emoji' in request.query || 'avatar' in request.query) {
				if (!isAnimationConvertibleImage && !('static' in request.query)) {
					image = {
						data: fs.createReadStream(file.path),
						ext: file.ext,
						type: file.mime,
					};
				} else {
					const data = (
						await sharpBmp(file.path, file.mime, {
							animated: !('static' in request.query),
						})
					)
						.resize({
							height: 'emoji' in request.query ? 128 : 320,
							withoutEnlargement: true,
						})
						.webp(webpDefault);

					image = {
						data,
						ext: 'webp',
						type: 'image/webp',
					};
				}
			} else if ('static' in request.query) {
				image = this.imageProcessingService.convertSharpToWebpStream(
					await sharpBmp(file.path, file.mime),
					498,
					422,
				);
			} else if ('preview' in request.query) {
				image = this.imageProcessingService.convertSharpToWebpStream(
					await sharpBmp(file.path, file.mime),
					200,
					200,
				);
			} else if ('badge' in request.query) {
				const mask = (await sharpBmp(file.path, file.mime))
					.resize(96, 96, {
						fit: 'contain',
						position: 'centre',
						withoutEnlargement: false,
					})
					.greyscale()
					.normalise()
					.linear(1.75, -(128 * 1.75) + 128) // 1.75x contrast
					.flatten({ background: '#000' })
					.toColorspace('b-w');

				const stats = await mask.clone().stats();

				if (stats.entropy < 0.1) {
					// エントロピーがあまりない場合は404にする
					throw new StatusError('Skip to provide badge', 404);
				}

				const data = sharp({
					create: {
						width: 96,
						height: 96,
						channels: 4,
						background: { r: 0, g: 0, b: 0, alpha: 0 },
					},
				})
					.pipelineColorspace('b-w')
					.boolean(await mask.png().toBuffer(), 'eor');

				image = {
					data: await data.png().toBuffer(),
					ext: 'png',
					type: 'image/png',
				};
			} else if (file.mime === 'image/svg+xml') {
				image = this.imageProcessingService.convertToWebpStream(
					file.path,
					2048,
					2048,
				);
			} else if (
				!file.mime.startsWith('image/') ||
				!FILE_TYPE_BROWSERSAFE.includes(file.mime)
			) {
				throw new StatusError('Rejected type', 403, 'Rejected type');
			}

			if (!image) {
				image = {
					data: fs.createReadStream(file.path),
					ext: file.ext,
					type: file.mime,
				};
			}

			if ('cleanup' in file) {
				if ('pipe' in image.data && typeof image.data.pipe === 'function') {
					// image.dataがstreamなら、stream終了後にcleanup
					image.data.on('end', file.cleanup);
					image.data.on('close', file.cleanup);
				} else {
					// image.dataがstreamでないなら直ちにcleanup
					file.cleanup();
				}
			}

			reply.header('Content-Type', image.type);
			reply.header('Cache-Control', 'max-age=31536000, immutable');
			reply.header(
				'Content-Disposition',
				contentDisposition('inline', correctFilename(file.filename, image.ext)),
			);
			return image.data;
		} catch (e) {
			if ('cleanup' in file) file.cleanup();
			throw e;
		}
	}

	private async getStreamAndTypeFromUrl(url: string): Promise<
		| {
				state: 'remote';
				fileRole?: 'thumbnail' | 'webpublic' | 'original';
				file?: DriveFile;
				mime: string;
				ext: string | null;
				path: string;
				cleanup: () => void;
				filename: string;
		  }
		| {
				state: 'stored_internal';
				fileRole: 'thumbnail' | 'webpublic' | 'original';
				file: DriveFile;
				filename: string;
				mime: string;
				ext: string | null;
				path: string;
		  }
		| '404'
		| '204'
	> {
		if (url.startsWith(`${this.configLoaderService.data.url}/files/`)) {
			const key = url
				.replace(`${this.configLoaderService.data.url}/files/`, '')
				.split('/')
				.shift();
			if (!key)
				throw new StatusError('Invalid File Key', 400, 'Invalid File Key');

			return await this.getFileFromKey(key);
		}

		return await this.downloadAndDetectTypeFromUrl(url);
	}

	private async downloadAndDetectTypeFromUrl(url: string): Promise<{
		state: 'remote';
		mime: string;
		ext: string | null;
		path: string;
		cleanup: () => void;
		filename: string;
	}> {
		const [path, cleanup] = await createTemp();
		try {
			const { filename } = await this.downloadService.downloadUrl(url, path);

			const { mime, ext } = await this.fileInfoService.detectType(path);

			return {
				state: 'remote',
				mime,
				ext,
				path,
				cleanup,
				filename,
			};
		} catch (e) {
			cleanup();
			throw e;
		}
	}

	private async getFileFromKey(key: string): Promise<
		| {
				state: 'remote';
				fileRole: 'thumbnail' | 'webpublic' | 'original';
				file: DriveFile;
				filename: string;
				url: string;
				mime: string;
				ext: string | null;
				path: string;
				cleanup: () => void;
		  }
		| {
				state: 'stored_internal';
				fileRole: 'thumbnail' | 'webpublic' | 'original';
				file: DriveFile;
				filename: string;
				mime: string;
				ext: string | null;
				path: string;
		  }
		| '404'
		| '204'
	> {
		// Fetch drive file
		const file = await this.prismaService.client.driveFile.findFirst({
			where: {
				OR: [
					{ accessKey: key },
					{ thumbnailAccessKey: key },
					{ webpublicAccessKey: key },
				],
			},
		});

		if (file == null) return '404';

		const isThumbnail = file.thumbnailAccessKey === key;
		const isWebpublic = file.webpublicAccessKey === key;

		if (!file.storedInternal) {
			if (!(file.isLink && file.uri)) return '204';
			const result = await this.downloadAndDetectTypeFromUrl(file.uri);
			return {
				...result,
				url: file.uri,
				fileRole: isThumbnail
					? 'thumbnail'
					: isWebpublic
					? 'webpublic'
					: 'original',
				file,
				filename: file.name,
			};
		}

		const path = this.internalStorageService.resolvePath(key);

		if (isThumbnail || isWebpublic) {
			const { mime, ext } = await this.fileInfoService.detectType(path);
			return {
				state: 'stored_internal',
				fileRole: isThumbnail ? 'thumbnail' : 'webpublic',
				file,
				filename: file.name,
				mime,
				ext,
				path,
			};
		}

		return {
			state: 'stored_internal',
			fileRole: 'original',
			file,
			filename: file.name,
			// 古いファイルは修正前のmimeを持っているのでできるだけ修正してあげる
			mime: this.fileInfoService.fixMime(file.type),
			ext: null,
			path,
		};
	}
}
