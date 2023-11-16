import * as http from 'node:http';
import * as https from 'node:https';
import * as net from 'node:net';
import CacheableLookup from 'cacheable-lookup';
import fetch from 'node-fetch';
import { HttpProxyAgent, HttpsProxyAgent } from 'hpagent';
import { Injectable } from '@nestjs/common';
import { StatusError } from '@/misc/status-error.js';
import { bindThis } from '@/decorators.js';
import { ConfigLoaderService } from '@/ConfigLoaderService.js';
import type { Response } from 'node-fetch';
import type { URL } from 'node:url';

@Injectable()
export class HttpRequestService {
	/**
	 * Get http non-proxy agent
	 */
	private readonly http: http.Agent;

	/**
	 * Get https non-proxy agent
	 */
	private readonly https: https.Agent;

	/**
	 * Get http proxy or non-proxy agent
	 */
	public httpAgent: http.Agent;

	/**
	 * Get https proxy or non-proxy agent
	 */
	public httpsAgent: https.Agent;

	constructor(
		private readonly configLoaderService: ConfigLoaderService,
	) {
		const cache = new CacheableLookup({
			maxTtl: 3600,	// 1hours
			errorTtl: 30,	// 30secs
			lookup: false,	// nativeのdns.lookupにfallbackしない
		});

		this.http = new http.Agent({
			keepAlive: true,
			keepAliveMsecs: 30 * 1000,
			lookup: cache.lookup as unknown as net.LookupFunction,
		});

		this.https = new https.Agent({
			keepAlive: true,
			keepAliveMsecs: 30 * 1000,
			lookup: cache.lookup as unknown as net.LookupFunction,
		});

		const maxSockets = Math.max(256, configLoaderService.data.deliverJobConcurrency);

		this.httpAgent = configLoaderService.data.proxy
			? new HttpProxyAgent({
				keepAlive: true,
				keepAliveMsecs: 30 * 1000,
				maxSockets,
				maxFreeSockets: 256,
				scheduling: 'lifo',
				proxy: configLoaderService.data.proxy,
			})
			: this.http;

		this.httpsAgent = configLoaderService.data.proxy
			? new HttpsProxyAgent({
				keepAlive: true,
				keepAliveMsecs: 30 * 1000,
				maxSockets,
				maxFreeSockets: 256,
				scheduling: 'lifo',
				proxy: configLoaderService.data.proxy,
			})
			: this.https;
	}

	/**
	 * Get agent by URL
	 * @param url URL
	 * @param bypassProxy Allways bypass proxy
	 */
	@bindThis
	public getAgentByUrl(url: URL, bypassProxy = false): http.Agent | https.Agent {
		if (bypassProxy || this.configLoaderService.data.proxyBypassHosts.includes(url.hostname)) {
			return url.protocol === 'http:' ? this.http : this.https;
		} else {
			return url.protocol === 'http:' ? this.httpAgent : this.httpsAgent;
		}
	}

	@bindThis
	public async getJson<T = unknown>(url: string, accept = 'application/json, */*', headers?: Record<string, string>): Promise<T> {
		const res = await this.send(url, {
			method: 'GET',
			headers: Object.assign({
				Accept: accept,
			}, headers ?? {}),
			timeout: 5000,
			size: 1024 * 256,
		});

		return await res.json() as T;
	}

	@bindThis
	public async getHtml(url: string, accept = 'text/html, */*', headers?: Record<string, string>): Promise<string> {
		const res = await this.send(url, {
			method: 'GET',
			headers: Object.assign({
				Accept: accept,
			}, headers ?? {}),
			timeout: 5000,
		});

		return await res.text();
	}

	@bindThis
	public async send(url: string, args: {
		method?: string,
		body?: string,
		headers?: Record<string, string>,
		timeout?: number,
		size?: number,
	} = {}, extra: {
		throwErrorWhenResponseNotOk: boolean;
	} = {
		throwErrorWhenResponseNotOk: true,
	}): Promise<Response> {
		const timeout = args.timeout ?? 5000;

		const controller = new AbortController();
		setTimeout(() => {
			controller.abort();
		}, timeout);

		const res = await fetch(url, {
			method: args.method ?? 'GET',
			headers: {
				'User-Agent': this.configLoaderService.data.userAgent,
				...(args.headers ?? {}),
			},
			body: args.body,
			size: args.size ?? 10 * 1024 * 1024,
			agent: (url) => this.getAgentByUrl(url),
			signal: controller.signal,
		});

		if (!res.ok && extra.throwErrorWhenResponseNotOk) {
			throw new StatusError(`${res.status} ${res.statusText}`, res.status, res.statusText);
		}

		return res;
	}
}
