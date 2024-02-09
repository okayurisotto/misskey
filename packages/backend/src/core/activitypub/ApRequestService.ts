import * as crypto from 'node:crypto';
import { URL } from 'node:url';
import { Injectable } from '@nestjs/common';
import { UserKeypairService } from '@/core/UserKeypairService.js';
import { HttpRequestService } from '@/core/HttpRequestService.js';
import Logger from '@/misc/logger.js';
import { ConfigLoaderService } from '@/ConfigLoaderService.js';
import type { user } from '@prisma/client';

type Request = {
	url: string;
	method: string;
	headers: Record<string, string>;
};

type Signed = {
	request: Request;
	signingString: string;
	signature: string;
	signatureHeader: string;
};

type PrivateKey = {
	privateKeyPem: string;
	keyId: string;
};

export class ApRequestCreator {
	public static createSignedPost(args: {
		key: PrivateKey;
		url: string;
		body: string;
		additionalHeaders: Record<string, string>;
	}): Signed {
		const u = new URL(args.url);
		const digestHeader = `SHA-256=${crypto
			.createHash('sha256')
			.update(args.body)
			.digest('base64')}`;

		const request: Request = {
			url: u.href,
			method: 'POST',
			headers: this.#objectAssignWithLcKey(
				{
					Date: new Date().toUTCString(),
					Host: u.host,
					'Content-Type': 'application/activity+json',
					Digest: digestHeader,
				},
				args.additionalHeaders,
			),
		};

		const result = this.#signToRequest(request, args.key, [
			'(request-target)',
			'date',
			'host',
			'digest',
		]);

		return {
			request,
			signingString: result.signingString,
			signature: result.signature,
			signatureHeader: result.signatureHeader,
		};
	}

	public static createSignedGet(args: {
		key: PrivateKey;
		url: string;
		additionalHeaders: Record<string, string>;
	}): Signed {
		const u = new URL(args.url);

		const request: Request = {
			url: u.href,
			method: 'GET',
			headers: this.#objectAssignWithLcKey(
				{
					Accept: 'application/activity+json, application/ld+json',
					Date: new Date().toUTCString(),
					Host: new URL(args.url).host,
				},
				args.additionalHeaders,
			),
		};

		const result = this.#signToRequest(request, args.key, [
			'(request-target)',
			'date',
			'host',
			'accept',
		]);

		return {
			request,
			signingString: result.signingString,
			signature: result.signature,
			signatureHeader: result.signatureHeader,
		};
	}

	static #signToRequest(
		request: Request,
		key: PrivateKey,
		includeHeaders: string[],
	): Signed {
		const signingString = this.#genSigningString(request, includeHeaders);
		const signature = crypto
			.sign('sha256', Buffer.from(signingString), key.privateKeyPem)
			.toString('base64');
		const signatureHeader = `keyId="${
			key.keyId
		}",algorithm="rsa-sha256",headers="${includeHeaders.join(
			' ',
		)}",signature="${signature}"`;

		request.headers = this.#objectAssignWithLcKey(request.headers, {
			Signature: signatureHeader,
		});
		// node-fetch will generate this for us. if we keep 'Host', it won't change with redirects!
		delete request.headers['host'];

		return {
			request,
			signingString,
			signature,
			signatureHeader,
		};
	}

	static #genSigningString(request: Request, includeHeaders: string[]): string {
		request.headers = this.#lcObjectKey(request.headers);

		const results: string[] = [];

		for (const key of includeHeaders.map((x) => x.toLowerCase())) {
			if (key === '(request-target)') {
				results.push(
					`(request-target): ${request.method.toLowerCase()} ${
						new URL(request.url).pathname
					}`,
				);
			} else {
				results.push(`${key}: ${request.headers[key]}`);
			}
		}

		return results.join('\n');
	}

	static #lcObjectKey(src: Record<string, string>): Record<string, string> {
		const dst: Record<string, string> = {};
		for (const key of Object.keys(src).filter(
			(x) => x !== '__proto__' && typeof src[x] === 'string',
		))
			dst[key.toLowerCase()] = src[key];
		return dst;
	}

	static #objectAssignWithLcKey(
		a: Record<string, string>,
		b: Record<string, string>,
	): Record<string, string> {
		return Object.assign(this.#lcObjectKey(a), this.#lcObjectKey(b));
	}
}

@Injectable()
export class ApRequestService {
	private readonly logger = new Logger('ap-request');

	constructor(
		private readonly configLoaderService: ConfigLoaderService,
		private readonly httpRequestService: HttpRequestService,
		private readonly userKeypairService: UserKeypairService,
	) {}

	public async signedPost(
		user: { id: user['id'] },
		url: string,
		object: unknown,
	): Promise<void> {
		const body = JSON.stringify(object);

		const keypair = await this.userKeypairService.getUserKeypair(user.id);

		const req = ApRequestCreator.createSignedPost({
			key: {
				privateKeyPem: keypair.privateKey,
				keyId: `${this.configLoaderService.data.url}/users/${user.id}#main-key`,
			},
			url,
			body,
			additionalHeaders: {},
		});

		await this.httpRequestService.send(url, {
			method: req.request.method,
			headers: req.request.headers,
			body,
		});
	}

	/**
	 * Get AP object with http-signature
	 * @param user http-signature user
	 * @param url URL to fetch
	 */
	public async signedGet(
		url: string,
		user: { id: user['id'] },
	): Promise<unknown> {
		const keypair = await this.userKeypairService.getUserKeypair(user.id);

		const req = ApRequestCreator.createSignedGet({
			key: {
				privateKeyPem: keypair.privateKey,
				keyId: `${this.configLoaderService.data.url}/users/${user.id}#main-key`,
			},
			url,
			additionalHeaders: {},
		});

		const res = await this.httpRequestService.send(url, {
			method: req.request.method,
			headers: req.request.headers,
		});

		return await res.json();
	}
}
