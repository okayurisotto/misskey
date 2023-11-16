import { fileURLToPath } from 'node:url';
import { Injectable } from '@nestjs/common';
import { ConfigLoaderService } from '@/ConfigLoaderService.js';
import { generateFullOpenApiSpec } from './gen-spec.js';
import type { FastifyInstance, FastifyPluginOptions } from 'fastify';

const staticAssets = fileURLToPath(new URL('../../../../assets/', import.meta.url));

@Injectable()
export class OpenApiServerService {
	constructor(
		private readonly configLoaderService: ConfigLoaderService,
	) {
	}

	public createServer(fastify: FastifyInstance, _options: FastifyPluginOptions, done: (err?: Error) => void): void {
		fastify.get('/api-doc', async (_request, reply) => {
			reply.header('Cache-Control', 'public, max-age=86400');
			return await reply.sendFile('/redoc.html', staticAssets);
		});
		fastify.get('/api.json', (_request, reply) => {
			reply.header('Cache-Control', 'public, max-age=600');
			reply.send(generateFullOpenApiSpec(this.configLoaderService.data));
		});
		done();
	}
}
