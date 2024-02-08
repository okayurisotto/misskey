import { randomUUID } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { createBullBoard } from '@bull-board/api';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter.js';
import { FastifyAdapter } from '@bull-board/fastify';
import ms from 'ms';
import sharp from 'sharp';
import pug from 'pug';
import fastifyStatic from '@fastify/static';
import fastifyView from '@fastify/view';
import fastifyCookie from '@fastify/cookie';
import fastifyProxy from '@fastify/http-proxy';
import vary from 'vary';
import { z } from 'zod';
import { getNoteSummary } from '@/misc/get-note-summary.js';
import * as Acct from '@/misc/acct.js';
import { MetaService } from '@/core/MetaService.js';
import type {
	DbQueue,
	DeliverQueue,
	EndedPollNotificationQueue,
	InboxQueue,
	ObjectStorageQueue,
	SystemQueue,
	WebhookDeliverQueue,
} from '@/core/QueueModule.js';
import { UserEntityService } from '@/core/entities/UserEntityService.js';
import { NoteEntityPackService } from '@/core/entities/NoteEntityPackService.js';
import { PageEntityService } from '@/core/entities/PageEntityService.js';
import { GalleryPostEntityService } from '@/core/entities/GalleryPostEntityService.js';
import { ClipEntityService } from '@/core/entities/ClipEntityService.js';
import { ChannelEntityService } from '@/core/entities/ChannelEntityService.js';
import { deepClone } from '@/misc/clone.js';
import { FlashEntityService } from '@/core/entities/FlashEntityService.js';
import { RoleService } from '@/core/RoleService.js';
import { PrismaService } from '@/core/PrismaService.js';
import { ConfigLoaderService } from '@/ConfigLoaderService.js';
import {
	BACKEND_STATIC_ASSETS_DIR,
	FLUENT_EMOJIS_DIST_DIR,
	FRONTEND_ASSETS_DIR,
	FRONTEND_STATIC_ASSETS_DIR,
	SW_ASSETS_DIR,
	TWEMOJI_DIST_DIR,
	VIEW_DIR,
	VITE_DIR,
} from '@/paths.js';
import manifest from './manifest.json' assert { type: 'json' };
import { FeedService } from './FeedService.js';
import { UrlPreviewService } from './UrlPreviewService.js';
import { ClientLoggerService } from './ClientLoggerService.js';
import type {
	FastifyInstance,
	FastifyPluginOptions,
	FastifyReply,
} from 'fastify';
import type { meta } from '@prisma/client';
import { UserEntityUtilService } from '@/core/entities/UserEntityUtilService.js';

type Manifest = {
	short_name: string;
	name: string;
	start_url: string;
	display: string;
	background_color: string;
	theme_color: string;
	icons: {
		src: string;
		sizes: string;
		type: string;
		purpose: string;
	}[];
	share_target: {
		action: string;
		method: string;
		enctype: string;
		params: {
			title: string;
			text: string;
			url: string;
		};
	};
};

type CommonPugData = {
	instanceName: string;
	icon: string | null;
	themeColor: string | null;
	serverErrorImageUrl: string;
	infoImageUrl: string;
	notFoundImageUrl: string;
};

@Injectable()
export class ClientServerService {
	constructor(
		private readonly configLoaderService: ConfigLoaderService,

		private readonly flashEntityService: FlashEntityService,
		private readonly userEntityService: UserEntityService,
		private readonly noteEntityService: NoteEntityPackService,
		private readonly pageEntityService: PageEntityService,
		private readonly galleryPostEntityService: GalleryPostEntityService,
		private readonly clipEntityService: ClipEntityService,
		private readonly channelEntityService: ChannelEntityService,
		private readonly metaService: MetaService,
		private readonly urlPreviewService: UrlPreviewService,
		private readonly feedService: FeedService,
		private readonly roleService: RoleService,
		private readonly clientLoggerService: ClientLoggerService,
		private readonly prismaService: PrismaService,
		private readonly userEntityUtilService: UserEntityUtilService,

		@Inject('queue:system')
		public systemQueue: SystemQueue,
		@Inject('queue:endedPollNotification')
		public endedPollNotificationQueue: EndedPollNotificationQueue,
		@Inject('queue:deliver')
		public deliverQueue: DeliverQueue,
		@Inject('queue:inbox')
		public inboxQueue: InboxQueue,
		@Inject('queue:db')
		public dbQueue: DbQueue,
		@Inject('queue:objectStorage')
		public objectStorageQueue: ObjectStorageQueue,
		@Inject('queue:webhookDeliver')
		public webhookDeliverQueue: WebhookDeliverQueue,
	) {}

	private async manifestHandler(reply: FastifyReply): Promise<Manifest> {
		const res = deepClone(manifest);

		const instance = await this.metaService.fetch(true);

		res.short_name = instance.name ?? 'Misskey';
		res.name = instance.name ?? 'Misskey';
		if (instance.themeColor) res.theme_color = instance.themeColor;

		reply.header('Cache-Control', 'max-age=300');
		return res;
	}

	private generateCommonPugData(meta: meta): CommonPugData {
		return {
			instanceName: meta.name ?? 'Misskey',
			icon: meta.iconUrl,
			themeColor: meta.themeColor,
			serverErrorImageUrl:
				meta.serverErrorImageUrl ?? 'https://xn--931a.moe/assets/error.jpg',
			infoImageUrl: meta.infoImageUrl ?? 'https://xn--931a.moe/assets/info.jpg',
			notFoundImageUrl:
				meta.notFoundImageUrl ?? 'https://xn--931a.moe/assets/not-found.jpg',
		};
	}

	public createServer(
		fastify: FastifyInstance,
		options: FastifyPluginOptions,
		done: (err?: Error) => void,
	): void {
		fastify.register(fastifyCookie, {});

		//#region Bull Dashboard
		const bullBoardPath = '/queue';

		// Authenticate
		fastify.addHook('onRequest', async (request, reply) => {
			if (
				request.url === bullBoardPath ||
				request.url.startsWith(bullBoardPath + '/')
			) {
				const token = request.cookies['token'];
				if (token == null) {
					reply.code(401);
					throw new Error('login required');
				}
				const user = await this.prismaService.client.user.findUnique({
					where: { token },
				});
				if (user == null) {
					reply.code(403);
					throw new Error('no such user');
				}
				const isAdministrator = await this.roleService.isAdministrator(user);
				if (!isAdministrator) {
					reply.code(403);
					throw new Error('access denied');
				}
			}
		});

		const serverAdapter = new FastifyAdapter();

		createBullBoard({
			queues: [
				this.systemQueue,
				this.endedPollNotificationQueue,
				this.deliverQueue,
				this.inboxQueue,
				this.dbQueue,
				this.objectStorageQueue,
				this.webhookDeliverQueue,
			].map((q) => new BullMQAdapter(q)),
			serverAdapter,
		});

		serverAdapter.setBasePath(bullBoardPath);
		(fastify.register as any)(serverAdapter.registerPlugin(), {
			prefix: bullBoardPath,
		});
		//#endregion

		fastify.register(fastifyView, {
			root: VIEW_DIR,
			engine: {
				pug: pug,
			},
			defaultContext: {
				version: this.configLoaderService.data.version,
				config: this.configLoaderService.data,
			},
		});

		fastify.addHook('onRequest', (request, reply, done) => {
			// クリックジャッキング防止のためiFrameの中に入れられないようにする
			reply.header('X-Frame-Options', 'DENY');
			done();
		});

		//#region vite assets
		if (this.configLoaderService.data.clientManifestExists) {
			fastify.register(fastifyStatic, {
				root: VITE_DIR,
				prefix: '/vite/',
				maxAge: ms('30 days'),
				decorateReply: false,
			});
		} else {
			fastify.register(fastifyProxy, {
				upstream: 'http://localhost:5173', // TODO: port configuration
				prefix: '/vite',
				rewritePrefix: '/vite',
			});
		}
		//#endregion

		//#region static assets

		fastify.register(fastifyStatic, {
			root: BACKEND_STATIC_ASSETS_DIR,
			prefix: '/static-assets/',
			maxAge: ms('7 days'),
			decorateReply: false,
		});

		fastify.register(fastifyStatic, {
			root: FRONTEND_STATIC_ASSETS_DIR,
			prefix: '/client-assets/',
			maxAge: ms('7 days'),
			decorateReply: false,
		});

		fastify.register(fastifyStatic, {
			root: FRONTEND_ASSETS_DIR,
			prefix: '/assets/',
			maxAge: ms('7 days'),
			decorateReply: false,
		});

		fastify.get('/favicon.ico', async (request, reply) => {
			return reply.sendFile('/favicon.ico', BACKEND_STATIC_ASSETS_DIR);
		});

		fastify.get('/apple-touch-icon.png', async (request, reply) => {
			return reply.sendFile('/apple-touch-icon.png', BACKEND_STATIC_ASSETS_DIR);
		});

		fastify.get<{ Params: { path: string } }>(
			'/fluent-emoji/:path(.*)',
			async (request, reply) => {
				const path = request.params.path;

				if (!path.match(/^[0-9a-f-]+\.png$/)) {
					reply.code(404);
					return;
				}

				reply.header(
					'Content-Security-Policy',
					"default-src 'none'; style-src 'unsafe-inline'",
				);

				return await reply.sendFile(path, FLUENT_EMOJIS_DIST_DIR, {
					maxAge: ms('30 days'),
				});
			},
		);

		fastify.get<{ Params: { path: string } }>(
			'/twemoji/:path(.*)',
			async (request, reply) => {
				const path = request.params.path;

				if (!path.match(/^[0-9a-f-]+\.svg$/)) {
					reply.code(404);
					return;
				}

				reply.header(
					'Content-Security-Policy',
					"default-src 'none'; style-src 'unsafe-inline'",
				);

				return await reply.sendFile(path, TWEMOJI_DIST_DIR, {
					maxAge: ms('30 days'),
				});
			},
		);

		fastify.get<{ Params: { path: string } }>(
			'/twemoji-badge/:path(.*)',
			async (request, reply) => {
				const path = request.params.path;

				if (!path.match(/^[0-9a-f-]+\.png$/)) {
					reply.code(404);
					return;
				}

				const mask = await sharp(
					`${TWEMOJI_DIST_DIR}/${path.replace('.png', '')}.svg`,
					{ density: 1000 },
				)
					.resize(488, 488)
					.greyscale()
					.normalise()
					.linear(1.75, -(128 * 1.75) + 128) // 1.75x contrast
					.flatten({ background: '#000' })
					.extend({
						top: 12,
						bottom: 12,
						left: 12,
						right: 12,
						background: '#000',
					})
					.toColorspace('b-w')
					.png()
					.toBuffer();

				const buffer = await sharp({
					create: {
						width: 512,
						height: 512,
						channels: 4,
						background: { r: 0, g: 0, b: 0, alpha: 0 },
					},
				})
					.pipelineColorspace('b-w')
					.boolean(mask, 'eor')
					.resize(96, 96)
					.png()
					.toBuffer();

				reply.header(
					'Content-Security-Policy',
					"default-src 'none'; style-src 'unsafe-inline'",
				);
				reply.header('Cache-Control', 'max-age=2592000');
				reply.header('Content-Type', 'image/png');
				return buffer;
			},
		);

		// ServiceWorker
		fastify.get('/sw.js', async (request, reply) => {
			return await reply.sendFile('/sw.js', SW_ASSETS_DIR, {
				maxAge: ms('10 minutes'),
			});
		});

		// Manifest
		fastify.get(
			'/manifest.json',
			async (request, reply) => await this.manifestHandler(reply),
		);

		fastify.get('/robots.txt', async (request, reply) => {
			return await reply.sendFile('/robots.txt', BACKEND_STATIC_ASSETS_DIR);
		});

		// OpenSearch XML
		fastify.get('/opensearch.xml', async (request, reply) => {
			const meta = await this.metaService.fetch();

			const name = meta.name ?? 'Misskey';
			let content = '';
			content +=
				'<OpenSearchDescription xmlns="http://a9.com/-/spec/opensearch/1.1/" xmlns:moz="http://www.mozilla.org/2006/browser/search/">';
			content += `<ShortName>${name}</ShortName>`;
			content += `<Description>${name} Search</Description>`;
			content += '<InputEncoding>UTF-8</InputEncoding>';
			content += `<Image width="16" height="16" type="image/x-icon">${this.configLoaderService.data.url}/favicon.ico</Image>`;
			content += `<Url type="text/html" template="${this.configLoaderService.data.url}/search?q={searchTerms}"/>`;
			content += '</OpenSearchDescription>';

			reply.header('Content-Type', 'application/opensearchdescription+xml');
			return await reply.send(content);
		});

		//#endregion

		const renderBase = async (reply: FastifyReply): Promise<never> => {
			const meta = await this.metaService.fetch();
			reply.header('Cache-Control', 'public, max-age=30');
			return await reply.view('base', {
				img: meta.bannerUrl,
				url: this.configLoaderService.data.url,
				title: meta.name ?? 'Misskey',
				desc: meta.description,
				...this.generateCommonPugData(meta),
			});
		};

		// URL preview endpoint
		fastify.get<{ Querystring: { url: string; lang: string } }>(
			'/url',
			(request, reply) => this.urlPreviewService.handle(request, reply),
		);

		// Atom
		fastify.get<{ Params: { user: string } }>(
			'/@:user.atom',
			async (request, reply) => {
				const feed = await this.feedService.packFeed(
					Acct.parse(request.params.user),
				);

				if (feed) {
					reply.header('Content-Type', 'application/atom+xml; charset=utf-8');
					return feed.atom1();
				} else {
					reply.code(404);
					return;
				}
			},
		);

		// RSS
		fastify.get<{ Params: { user: string } }>(
			'/@:user.rss',
			async (request, reply) => {
				const feed = await this.feedService.packFeed(
					Acct.parse(request.params.user),
				);

				if (feed) {
					reply.header('Content-Type', 'application/rss+xml; charset=utf-8');
					return feed.rss2();
				} else {
					reply.code(404);
					return;
				}
			},
		);

		// JSON
		fastify.get<{ Params: { user: string } }>(
			'/@:user.json',
			async (request, reply) => {
				const feed = await this.feedService.packFeed(
					Acct.parse(request.params.user),
				);

				if (feed) {
					reply.header('Content-Type', 'application/json; charset=utf-8');
					return feed.json1();
				} else {
					reply.code(404);
					return;
				}
			},
		);

		//#region SSR (for crawlers)
		// User
		fastify.get<{ Params: { user: string; sub?: string } }>(
			'/@:user/:sub?',
			async (request, reply) => {
				const { username, host } = Acct.parse(request.params.user);
				const user = await this.prismaService.client.user.findFirst({
					where: {
						usernameLower: username.toLowerCase(),
						host: host ?? null,
						isSuspended: false,
					},
				});

				if (user != null) {
					const profile =
						await this.prismaService.client.user_profile.findUniqueOrThrow({
							where: { userId: user.id },
						});
					const meta = await this.metaService.fetch();
					const me = profile.fields
						? z
								.array(z.object({ value: z.string() }))
								.parse(profile.fields)
								.filter(
									(filed) =>
										filed.value != null && filed.value.match(/^https?:/),
								)
								.map((field) => field.value)
						: [];

					reply.header('Cache-Control', 'public, max-age=15');
					if (profile.preventAiLearning) {
						reply.header('X-Robots-Tag', 'noimageai');
						reply.header('X-Robots-Tag', 'noai');
					}
					return await reply.view('user', {
						user,
						profile,
						me,
						avatarUrl:
							user.avatarUrl ??
							this.userEntityUtilService.getIdenticonUrl(user),
						sub: request.params.sub,
						...this.generateCommonPugData(meta),
					});
				} else {
					// リモートユーザーなので
					// モデレータがAPI経由で参照可能にするために404にはしない
					return await renderBase(reply);
				}
			},
		);

		fastify.get<{ Params: { user: string } }>(
			'/users/:user',
			async (request, reply) => {
				const user = await this.prismaService.client.user.findFirst({
					where: {
						id: request.params.user,
						host: null,
						isSuspended: false,
					},
				});

				if (user == null) {
					reply.code(404);
					return;
				}

				reply.redirect(
					`/@${user.username}${user.host == null ? '' : '@' + user.host}`,
				);
			},
		);

		// Note
		fastify.get<{ Params: { note: string } }>(
			'/notes/:note',
			async (request, reply) => {
				vary(reply.raw, 'Accept');

				const note = await this.prismaService.client.note.findUnique({
					where: {
						id: request.params.note,
						visibility: { in: ['public', 'home'] },
					},
				});

				if (note) {
					const _note = await this.noteEntityService.pack(note);
					const profile =
						await this.prismaService.client.user_profile.findUniqueOrThrow({
							where: { userId: note.userId },
						});
					const meta = await this.metaService.fetch();
					reply.header('Cache-Control', 'public, max-age=15');
					if (profile.preventAiLearning) {
						reply.header('X-Robots-Tag', 'noimageai');
						reply.header('X-Robots-Tag', 'noai');
					}
					return await reply.view('note', {
						note: _note,
						profile,
						avatarUrl: _note.user.avatarUrl,
						// TODO: Let locale changeable by instance setting
						summary: getNoteSummary(_note),
						...this.generateCommonPugData(meta),
					});
				} else {
					return await renderBase(reply);
				}
			},
		);

		// Page
		fastify.get<{ Params: { user: string; page: string } }>(
			'/@:user/pages/:page',
			async (request, reply) => {
				const { username, host } = Acct.parse(request.params.user);
				const user = await this.prismaService.client.user.findFirst({
					where: {
						usernameLower: username.toLowerCase(),
						host: host ?? null,
					},
				});

				if (user == null) return;

				const page = await this.prismaService.client.page.findUnique({
					where: {
						userId_name: {
							name: request.params.page,
							userId: user.id,
						},
					},
				});

				if (page) {
					const _page = await this.pageEntityService.pack(page);
					const profile =
						await this.prismaService.client.user_profile.findUniqueOrThrow({
							where: { userId: page.userId },
						});
					const meta = await this.metaService.fetch();
					if (['public'].includes(page.visibility)) {
						reply.header('Cache-Control', 'public, max-age=15');
					} else {
						reply.header(
							'Cache-Control',
							'private, max-age=0, must-revalidate',
						);
					}
					if (profile.preventAiLearning) {
						reply.header('X-Robots-Tag', 'noimageai');
						reply.header('X-Robots-Tag', 'noai');
					}
					return await reply.view('page', {
						page: _page,
						profile,
						avatarUrl: _page.user.avatarUrl,
						...this.generateCommonPugData(meta),
					});
				} else {
					return await renderBase(reply);
				}
			},
		);

		// Flash
		fastify.get<{ Params: { id: string } }>(
			'/play/:id',
			async (request, reply) => {
				const flash = await this.prismaService.client.flash.findUnique({
					where: {
						id: request.params.id,
					},
				});

				if (flash) {
					const _flash = await this.flashEntityService.pack(flash);
					const profile =
						await this.prismaService.client.user_profile.findUniqueOrThrow({
							where: { userId: flash.userId },
						});
					const meta = await this.metaService.fetch();
					reply.header('Cache-Control', 'public, max-age=15');
					if (profile.preventAiLearning) {
						reply.header('X-Robots-Tag', 'noimageai');
						reply.header('X-Robots-Tag', 'noai');
					}
					return await reply.view('flash', {
						flash: _flash,
						profile,
						avatarUrl: _flash.user.avatarUrl,
						...this.generateCommonPugData(meta),
					});
				} else {
					return await renderBase(reply);
				}
			},
		);

		// Clip
		fastify.get<{ Params: { clip: string } }>(
			'/clips/:clip',
			async (request, reply) => {
				const clip = await this.prismaService.client.clip.findUnique({
					where: {
						id: request.params.clip,
					},
				});

				if (clip && clip.isPublic) {
					const _clip = await this.clipEntityService.pack(clip);
					const profile =
						await this.prismaService.client.user_profile.findUniqueOrThrow({
							where: { userId: clip.userId },
						});
					const meta = await this.metaService.fetch();
					reply.header('Cache-Control', 'public, max-age=15');
					if (profile.preventAiLearning) {
						reply.header('X-Robots-Tag', 'noimageai');
						reply.header('X-Robots-Tag', 'noai');
					}
					return await reply.view('clip', {
						clip: _clip,
						profile,
						avatarUrl: _clip.user.avatarUrl,
						...this.generateCommonPugData(meta),
					});
				} else {
					return await renderBase(reply);
				}
			},
		);

		// Gallery post
		fastify.get<{ Params: { post: string } }>(
			'/gallery/:post',
			async (request, reply) => {
				const post = await this.prismaService.client.gallery.findUnique({
					where: { id: request.params.post },
				});

				if (post) {
					const _post = await this.galleryPostEntityService.pack(post);
					const profile =
						await this.prismaService.client.user_profile.findUniqueOrThrow({
							where: { userId: post.userId },
						});
					const meta = await this.metaService.fetch();
					reply.header('Cache-Control', 'public, max-age=15');
					if (profile.preventAiLearning) {
						reply.header('X-Robots-Tag', 'noimageai');
						reply.header('X-Robots-Tag', 'noai');
					}
					return await reply.view('gallery-post', {
						post: _post,
						profile,
						avatarUrl: _post.user.avatarUrl,
						...this.generateCommonPugData(meta),
					});
				} else {
					return await renderBase(reply);
				}
			},
		);

		// Channel
		fastify.get<{ Params: { channel: string } }>(
			'/channels/:channel',
			async (request, reply) => {
				const channel = await this.prismaService.client.channel.findUnique({
					where: {
						id: request.params.channel,
					},
				});

				if (channel) {
					const _channel = await this.channelEntityService.pack(channel);
					const meta = await this.metaService.fetch();
					reply.header('Cache-Control', 'public, max-age=15');
					return await reply.view('channel', {
						channel: _channel,
						...this.generateCommonPugData(meta),
					});
				} else {
					return await renderBase(reply);
				}
			},
		);
		//#endregion

		fastify.get('/_info_card_', async (request, reply) => {
			const meta = await this.metaService.fetch(true);

			reply.removeHeader('X-Frame-Options');

			return await reply.view('info-card', {
				version: this.configLoaderService.data.version,
				host: this.configLoaderService.data.host,
				meta: meta,
				originalUsersCount: await this.prismaService.client.user.count({
					where: { host: null },
				}),
				originalNotesCount: await this.prismaService.client.note.count({
					where: { userHost: null },
				}),
			});
		});

		fastify.get('/bios', async (request, reply) => {
			return await reply.view('bios', {
				version: this.configLoaderService.data.version,
			});
		});

		fastify.get('/cli', async (request, reply) => {
			return await reply.view('cli', {
				version: this.configLoaderService.data.version,
			});
		});

		fastify.get('/flush', async (request, reply) => {
			return await reply.view('flush');
		});

		// streamingに非WebSocketリクエストが来た場合にbase htmlをキャシュ付きで返すと、Proxy等でそのパスがキャッシュされておかしくなる
		fastify.get('/streaming', async (request, reply) => {
			reply.code(503);
			reply.header('Cache-Control', 'private, max-age=0');
		});

		// Render base html for all requests
		fastify.get('*', async (request, reply) => {
			return await renderBase(reply);
		});

		fastify.setErrorHandler(async (error, request, reply) => {
			const errId = randomUUID();
			this.clientLoggerService.logger.error(
				`Internal error occured in ${request.routerPath}: ${error.message}`,
				{
					path: request.routerPath,
					params: request.params,
					query: request.query,
					code: error.name,
					stack: error.stack,
					id: errId,
				},
			);
			reply.code(500);
			reply.header('Cache-Control', 'max-age=10, must-revalidate');
			return await reply.view('error', {
				code: error.code,
				id: errId,
			});
		});

		done();
	}
}
