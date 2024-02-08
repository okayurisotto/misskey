import { URL } from 'node:url';
import * as http from 'node:http';
import * as https from 'node:https';
import { Injectable } from '@nestjs/common';
import { DeleteObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';
import {
	NodeHttpHandler,
	NodeHttpHandlerOptions,
} from '@aws-sdk/node-http-handler';
import { HttpRequestService } from '@/core/HttpRequestService.js';
import type {
	AbortMultipartUploadCommandOutput,
	CompleteMultipartUploadCommandOutput,
	DeleteObjectCommandInput,
	DeleteObjectCommandOutput,
	PutObjectCommandInput,
} from '@aws-sdk/client-s3';
import type { Meta } from '@prisma/client';

@Injectable()
export class S3Service {
	constructor(private readonly httpRequestService: HttpRequestService) {}

	public getS3Client(meta: Meta): S3Client {
		const u = meta.objectStorageEndpoint
			? `${meta.objectStorageUseSSL ? 'https' : 'http'}://${
					meta.objectStorageEndpoint
			  }`
			: `${meta.objectStorageUseSSL ? 'https' : 'http'}://example.net`; // dummy url to select http(s) agent

		const agent = this.httpRequestService.getAgentByUrl(
			new URL(u),
			!meta.objectStorageUseProxy,
		);
		const handlerOption: NodeHttpHandlerOptions = {};
		if (meta.objectStorageUseSSL) {
			handlerOption.httpsAgent = agent as https.Agent;
		} else {
			handlerOption.httpAgent = agent as http.Agent;
		}

		return new S3Client({
			endpoint: meta.objectStorageEndpoint ? u : undefined,
			credentials:
				meta.objectStorageAccessKey !== null &&
				meta.objectStorageSecretKey !== null
					? {
							accessKeyId: meta.objectStorageAccessKey,
							secretAccessKey: meta.objectStorageSecretKey,
					  }
					: undefined,
			region: meta.objectStorageRegion ? meta.objectStorageRegion : undefined, // 空文字列もundefinedにするため ?? は使わない
			tls: meta.objectStorageUseSSL,
			forcePathStyle: meta.objectStorageEndpoint
				? meta.objectStorageS3ForcePathStyle
				: false, // AWS with endPoint omitted
			requestHandler: new NodeHttpHandler(handlerOption),
		});
	}

	public async upload(
		meta: Meta,
		input: PutObjectCommandInput,
	): Promise<
		AbortMultipartUploadCommandOutput | CompleteMultipartUploadCommandOutput
	> {
		const client = this.getS3Client(meta);
		return await new Upload({
			client,
			params: input,
			partSize:
				client.config.endpoint &&
				(await client.config.endpoint()).hostname === 'storage.googleapis.com'
					? 500 * 1024 * 1024
					: 8 * 1024 * 1024,
		}).done();
	}

	public async delete(
		meta: Meta,
		input: DeleteObjectCommandInput,
	): Promise<DeleteObjectCommandOutput> {
		const client = this.getS3Client(meta);
		return await client.send(new DeleteObjectCommand(input));
	}
}
