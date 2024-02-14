import * as fs from 'node:fs';
import * as stream from 'node:stream/promises';
import { Injectable } from '@nestjs/common';
import ipaddr from 'ipaddr.js';
import chalk from 'chalk';
import got, * as Got from 'got';
import { parse } from 'content-disposition';
import { NODE_ENV } from '@/env.js';
import { HttpRequestService } from '@/core/HttpRequestService.js';
import { createTemp } from '@/misc/create-temp.js';
import { StatusError } from '@/misc/status-error.js';
import Logger from '@/misc/logger.js';

import { ConfigLoaderService } from '@/ConfigLoaderService.js';

@Injectable()
export class DownloadService {
	private readonly logger = new Logger('download');

	constructor(
		private readonly configLoaderService: ConfigLoaderService,
		private readonly httpRequestService: HttpRequestService,
	) {}

	public async downloadUrl(
		url: string,
		path: string,
	): Promise<{
		filename: string;
	}> {
		this.logger.info(
			`Downloading ${chalk.cyan(url)} to ${chalk.cyanBright(path)} ...`,
		);

		const timeout = 30 * 1000;
		const operationTimeout = 60 * 1000;
		const maxSize = this.configLoaderService.data.maxFileSize;

		const urlObj = new URL(url);
		let filename = urlObj.pathname.split('/').pop() ?? 'untitled';

		const req = got
			.stream(url, {
				headers: {
					'User-Agent': this.configLoaderService.data.userAgent,
				},
				timeout: {
					lookup: timeout,
					connect: timeout,
					secureConnect: timeout,
					socket: timeout, // read timeout
					response: timeout,
					send: timeout,
					request: operationTimeout, // whole operation timeout
				},
				agent: {
					http: this.httpRequestService.httpAgent,
					https: this.httpRequestService.httpsAgent,
				},
				http2: false, // default
				retry: {
					limit: 0,
				},
				enableUnixSockets: false,
			})
			.on('response', (res: Got.Response) => {
				if (
					(NODE_ENV === 'production' || NODE_ENV === 'test') &&
					!this.configLoaderService.data.proxy &&
					res.ip
				) {
					if (this.isPrivateIp(res.ip)) {
						this.logger.warn(`Blocked address: ${res.ip}`);
						req.destroy();
					}
				}

				const contentLength = res.headers['content-length'];
				if (contentLength != null) {
					const size = Number(contentLength);
					if (size > maxSize) {
						this.logger.warn(
							`maxSize exceeded (${size} > ${maxSize}) on response`,
						);
						req.destroy();
					}
				}

				const contentDisposition = res.headers['content-disposition'];
				if (contentDisposition != null) {
					try {
						const parsed = parse(contentDisposition);
						if (parsed.parameters['filename']) {
							filename = parsed.parameters['filename'];
						}
					} catch (e) {
						this.logger.warn(
							`Failed to parse content-disposition: ${contentDisposition}`,
						);
					}
				}
			})
			.on('downloadProgress', (progress: Got.Progress) => {
				if (progress.transferred > maxSize) {
					this.logger.warn(
						`maxSize exceeded (${progress.transferred} > ${maxSize}) on downloadProgress`,
					);
					req.destroy();
				}
			});

		try {
			await stream.pipeline(req, fs.createWriteStream(path));
		} catch (e) {
			if (e instanceof Got.HTTPError) {
				throw new StatusError(
					`${e.response.statusCode} ${e.response.statusMessage}`,
					e.response.statusCode,
					e.response.statusMessage,
				);
			} else {
				throw e;
			}
		}

		this.logger.succ(`Download finished: ${chalk.cyan(url)}`);

		return {
			filename,
		};
	}

	public async downloadTextFile(url: string): Promise<string> {
		// Create temp file
		const [path, cleanup] = await createTemp();

		this.logger.info(`text file: Temp file is ${path}`);

		try {
			// write content at URL to temp file
			await this.downloadUrl(url, path);

			const text = await fs.promises.readFile(path, 'utf8');

			return text;
		} finally {
			cleanup();
		}
	}

	private isPrivateIp(ip: string): boolean {
		const parsedIp = ipaddr.parse(ip);

		const allowedPrivateNetworks =
			this.configLoaderService.data.allowedPrivateNetworks.map((net) => {
				return ipaddr.parseCIDR(net);
			});

		const isAllowdedPrivateNetwork = allowedPrivateNetworks.some((net) => {
			return parsedIp.match(net);
		});

		if (isAllowdedPrivateNetwork) return false;

		return parsedIp.range() !== 'unicast';
	}
}
