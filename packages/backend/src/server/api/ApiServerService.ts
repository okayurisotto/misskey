import { Injectable } from '@nestjs/common';
import cors from '@fastify/cors';
import multipart from '@fastify/multipart';
import fastifyCookie from '@fastify/cookie';
import { ModuleRef } from '@nestjs/core';
import { UserEntityService } from '@/core/entities/UserEntityService.js';
import { PrismaService } from '@/core/PrismaService.js';
import { ConfigLoaderService } from '@/ConfigLoaderService.js';
import endpoints from './endpoints.js';
import { ApiCallService } from './ApiCallService.js';
import { SignupApiService } from './SignupApiService.js';
import { SigninApiService } from './SigninApiService.js';
import type { FastifyInstance, FastifyPluginOptions } from 'fastify';

@Injectable()
export class ApiServerService {
	constructor(
		private readonly moduleRef: ModuleRef,

		private readonly configLoaderService: ConfigLoaderService,

		private readonly userEntityService: UserEntityService,
		private readonly apiCallService: ApiCallService,
		private readonly signupApiService: SignupApiService,
		private readonly signinApiService: SigninApiService,
		private readonly prismaService: PrismaService,
	) {
		//this.createServer = this.createServer.bind(this);
	}

	public createServer(fastify: FastifyInstance, options: FastifyPluginOptions, done: (err?: Error) => void): void {
		fastify.register(cors, {
			origin: '*',
		});

		fastify.register(multipart, {
			limits: {
				fileSize: this.configLoaderService.data.maxFileSize,
				files: 1,
			},
		});

		fastify.register(fastifyCookie, {});

		// Prevent cache
		fastify.addHook('onRequest', (request, reply, done) => {
			reply.header('Cache-Control', 'private, max-age=0, must-revalidate');
			done();
		});

		for (const endpoint of endpoints) {
			const ep = {
				name: endpoint.name,
				meta: endpoint.meta,
				params: endpoint.params,
				exec: this.moduleRef.get('ep:' + endpoint.name, { strict: false }).exec,
			};

			if (endpoint.meta.requireFile) {
				fastify.all<{
					Params: { endpoint: string; },
					Body: Record<string, unknown>,
					Querystring: Record<string, unknown>,
				}>('/' + endpoint.name, async (request, reply) => {
					if (request.method === 'GET' && !endpoint.meta.allowGet) {
						reply.code(405);
						reply.send();
						return;
					}

					// Await so that any error can automatically be translated to HTTP 500
					await this.apiCallService.handleMultipartRequest(ep, request, reply);
					return reply;
				});
			} else {
				fastify.all<{
					Params: { endpoint: string; },
					Body: Record<string, unknown>,
					Querystring: Record<string, unknown>,
				}>('/' + endpoint.name, { bodyLimit: 1024 * 1024 }, async (request, reply) => {
					if (request.method === 'GET' && !endpoint.meta.allowGet) {
						reply.code(405);
						reply.send();
						return;
					}

					// Await so that any error can automatically be translated to HTTP 500
					await this.apiCallService.handleRequest(ep, request, reply);
					return reply;
				});
			}
		}

		fastify.post<{
			Body: {
				username: string;
				password: string;
				host?: string;
				invitationCode?: string;
				emailAddress?: string;
				'hcaptcha-response'?: string;
				'g-recaptcha-response'?: string;
				'turnstile-response'?: string;
			}
		}>('/signup', (request, reply) => this.signupApiService.signup(request, reply));

		fastify.post<{
			Body: {
				username: string;
				password: string;
				token?: string;
				signature?: string;
				authenticatorData?: string;
				clientDataJSON?: string;
				credentialId?: string;
				challengeId?: string;
			};
		}>('/signin', (request, reply) => this.signinApiService.signin(request, reply));

		fastify.post<{ Body: { code: string; } }>('/signup-pending', (request, reply) => this.signupApiService.signupPending(request, reply));

		fastify.get('/v1/instance/peers', async (request, reply) => {
			const instances = await this.prismaService.client.instance.findMany({
				where: {
					isSuspended: false,
				},
			});

			return instances.map(instance => instance.host);
		});

		fastify.post<{ Params: { session: string; } }>('/miauth/:session/check', async (request, reply) => {
			const token = await this.prismaService.client.accessToken.findFirst({
				where: {
					session: request.params.session,
				},
			});

			if (token && token.session != null && !token.fetched) {
				this.prismaService.client.accessToken.update({
					where: { id: token.id },
					data: { fetched: true },
				});

				return {
					ok: true,
					token: token.token,
					user: await this.userEntityService.packDetailed(token.userId, null),
				};
			} else {
				return {
					ok: false,
				};
			}
		});

		// Make sure any unknown path under /api returns HTTP 404 Not Found,
		// because otherwise ClientServerService will return the base client HTML
		// page with HTTP 200.
		fastify.get('/*', (request, reply) => {
			reply.code(404);
			// Mock ApiCallService.send's error handling
			reply.send({
				error: {
					message: 'Unknown API endpoint.',
					code: 'UNKNOWN_API_ENDPOINT',
					id: '2ca3b769-540a-4f08-9dd5-b5a825b6d0f1',
					kind: 'client',
				},
			});
		});

		done();
	}
}
