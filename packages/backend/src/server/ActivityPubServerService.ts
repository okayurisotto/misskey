import { IncomingMessage } from 'node:http';
import { Injectable } from '@nestjs/common';
import fastifyAccepts from '@fastify/accepts';
import httpSignature from '@peertube/http-signature';
import accepts from 'accepts';
import vary from 'vary';
import * as url from '@/misc/prelude/url.js';
import { ApRendererService } from '@/core/activitypub/ApRendererService.js';
import { QueueService } from '@/core/QueueService.js';
import type { LocalUser, RemoteUser } from '@/models/entities/User.js';
import { UserKeypairService } from '@/core/UserKeypairService.js';
import { UtilityService } from '@/core/UtilityService.js';
import { UserEntityService } from '@/core/entities/UserEntityService.js';
import { IActivity } from '@/core/activitypub/type.js';
import { PrismaService } from '@/core/PrismaService.js';
import { PrismaQueryService } from '@/core/PrismaQueryService.js';
import type { FastifyInstance, FastifyRequest, FastifyReply, FastifyPluginOptions } from 'fastify';
import type { Prisma, note, user } from '@prisma/client';
import { ConfigLoaderService } from '@/ConfigLoaderService.js';

const ACTIVITY_JSON = 'application/activity+json; charset=utf-8';
const LD_JSON = 'application/ld+json; profile="https://www.w3.org/ns/activitystreams"; charset=utf-8';

@Injectable()
export class ActivityPubServerService {
	constructor(
		private readonly configLoaderService: ConfigLoaderService,

		private readonly utilityService: UtilityService,
		private readonly userEntityService: UserEntityService,
		private readonly apRendererService: ApRendererService,
		private readonly queueService: QueueService,
		private readonly userKeypairService: UserKeypairService,
		private readonly prismaService: PrismaService,
		private readonly prismaQueryService: PrismaQueryService,
	) {
		//this.createServer = this.createServer.bind(this);
	}

	private setResponseType(request: FastifyRequest, reply: FastifyReply): void {
		const accept = request.accepts().type([ACTIVITY_JSON, LD_JSON]);
		if (accept === LD_JSON) {
			reply.type(LD_JSON);
		} else {
			reply.type(ACTIVITY_JSON);
		}
	}

	/**
	 * Pack Create<Note> or Announce Activity
	 * @param note Note
	 */
	private async packActivity(note: note): Promise<any> {
		if (note.renoteId && note.text == null && !note.hasPoll && (note.fileIds == null || note.fileIds.length === 0)) {
			const renote = await this.prismaService.client.note.findUniqueOrThrow({ where: { id: note.renoteId } });
			return this.apRendererService.renderAnnounce(renote.uri ? renote.uri : `${this.configLoaderService.data.url}/notes/${renote.id}`, note);
		}

		return this.apRendererService.renderCreate(await this.apRendererService.renderNote(note, false), note);
	}

	private inbox(request: FastifyRequest, reply: FastifyReply): void {
		let signature;

		try {
			signature = httpSignature.parseRequest(request.raw, { 'headers': [] });
		} catch (e) {
			reply.code(401);
			return;
		}

		// TODO: request.bodyのバリデーション？
		this.queueService.inbox(request.body as IActivity, signature);

		reply.code(202);
	}

	private async followers(
		request: FastifyRequest<{ Params: { user: string; }; Querystring: { cursor?: string; page?: string; }; }>,
		reply: FastifyReply,
	): Promise<any> {
		const userId = request.params.user;

		const cursor = request.query.cursor;
		if (cursor != null && typeof cursor !== 'string') {
			reply.code(400);
			return;
		}

		const page = request.query.page === 'true';

		const user = await this.prismaService.client.user.findUnique({
			where: {
				id: userId,
				host: null,
			},
		});

		if (user == null) {
			reply.code(404);
			return;
		}

		//#region Check ff visibility
		const profile = await this.prismaService.client.user_profile.findUniqueOrThrow({ where: { userId: user.id } });

		if (profile.ffVisibility === 'private') {
			reply.code(403);
			reply.header('Cache-Control', 'public, max-age=30');
			return;
		} else if (profile.ffVisibility === 'followers') {
			reply.code(403);
			reply.header('Cache-Control', 'public, max-age=30');
			return;
		}
		//#endregion

		const limit = 10;
		const partOf = `${this.configLoaderService.data.url}/users/${userId}/followers`;

		if (page) {
			const query: Prisma.followingWhereInput = {
				followeeId: user.id,
			};

			// カーソルが指定されている場合
			if (cursor) {
				query.id = { lt: cursor };
			}

			// Get followers
			const followings = await this.prismaService.client.following.findMany({
				where: query,
				take: limit + 1,
				orderBy: { id: 'desc' },
			});

			// 「次のページ」があるかどうか
			const inStock = followings.length === limit + 1;
			if (inStock) followings.pop();

			const renderedFollowers = await Promise.all(followings.map(following => this.apRendererService.renderFollowUser(following.followerId)));
			const rendered = this.apRendererService.renderOrderedCollectionPage(
				`${partOf}?${url.query({
					page: 'true',
					cursor,
				})}`,
				user.followersCount, renderedFollowers, partOf,
				undefined,
				inStock ? `${partOf}?${url.query({
					page: 'true',
					cursor: followings.at(-1)!.id,
				})}` : undefined,
			);

			this.setResponseType(request, reply);
			return (this.apRendererService.addContext(rendered));
		} else {
			// index page
			const rendered = this.apRendererService.renderOrderedCollection(
				partOf,
				user.followersCount,
				`${partOf}?page=true`,
			);
			reply.header('Cache-Control', 'public, max-age=180');
			this.setResponseType(request, reply);
			return (this.apRendererService.addContext(rendered));
		}
	}

	private async following(
		request: FastifyRequest<{ Params: { user: string; }; Querystring: { cursor?: string; page?: string; }; }>,
		reply: FastifyReply,
	): Promise<any> {
		const userId = request.params.user;

		const cursor = request.query.cursor;
		if (cursor != null && typeof cursor !== 'string') {
			reply.code(400);
			return;
		}

		const page = request.query.page === 'true';

		const user = await this.prismaService.client.user.findUnique({
			where: {
				id: userId,
				host: null,
			},
		});

		if (user == null) {
			reply.code(404);
			return;
		}

		//#region Check ff visibility
		const profile = await this.prismaService.client.user_profile.findUniqueOrThrow({ where: { userId: user.id } });

		if (profile.ffVisibility === 'private') {
			reply.code(403);
			reply.header('Cache-Control', 'public, max-age=30');
			return;
		} else if (profile.ffVisibility === 'followers') {
			reply.code(403);
			reply.header('Cache-Control', 'public, max-age=30');
			return;
		}
		//#endregion

		const limit = 10;
		const partOf = `${this.configLoaderService.data.url}/users/${userId}/following`;

		if (page) {
			const query: Prisma.followingWhereInput = {
				followerId: user.id,
			};

			// カーソルが指定されている場合
			if (cursor) {
				query.id = { lt: cursor };
			}

			// Get followings
			const followings = await this.prismaService.client.following.findMany({
				where: query,
				take: limit + 1,
				orderBy: { id: 'desc' },
			});

			// 「次のページ」があるかどうか
			const inStock = followings.length === limit + 1;
			if (inStock) followings.pop();

			const renderedFollowees = await Promise.all(followings.map(following => this.apRendererService.renderFollowUser(following.followeeId)));
			const rendered = this.apRendererService.renderOrderedCollectionPage(
				`${partOf}?${url.query({
					page: 'true',
					cursor,
				})}`,
				user.followingCount, renderedFollowees, partOf,
				undefined,
				inStock ? `${partOf}?${url.query({
					page: 'true',
					cursor: followings.at(-1)!.id,
				})}` : undefined,
			);

			this.setResponseType(request, reply);
			return (this.apRendererService.addContext(rendered));
		} else {
			// index page
			const rendered = this.apRendererService.renderOrderedCollection(
				partOf,
				user.followingCount,
				`${partOf}?page=true`,
			);
			reply.header('Cache-Control', 'public, max-age=180');
			this.setResponseType(request, reply);
			return (this.apRendererService.addContext(rendered));
		}
	}

	private async featured(request: FastifyRequest<{ Params: { user: string; }; }>, reply: FastifyReply): Promise<any> {
		const userId = request.params.user;

		const user = await this.prismaService.client.user.findUnique({
			where: {
				id: userId,
				host: null,
			},
		});

		if (user == null) {
			reply.code(404);
			return;
		}

		const pinings = await this.prismaService.client.user_note_pining.findMany({
			where: { userId: user.id },
			orderBy: { id: 'desc' },
		});

		const pinnedNotes = await Promise.all(pinings.map(pining =>
			this.prismaService.client.note.findUniqueOrThrow({ where: { id: pining.noteId } })));

		const renderedNotes = await Promise.all(pinnedNotes.map(note => this.apRendererService.renderNote(note)));

		const rendered = this.apRendererService.renderOrderedCollection(
			`${this.configLoaderService.data.url}/users/${userId}/collections/featured`,
			renderedNotes.length,
			undefined,
			undefined,
			renderedNotes,
		);

		reply.header('Cache-Control', 'public, max-age=180');
		this.setResponseType(request, reply);
		return (this.apRendererService.addContext(rendered));
	}

	private async outbox(
		request: FastifyRequest<{
			Params: { user: string; };
			Querystring: { since_id?: string; until_id?: string; page?: string; };
		}>,
		reply: FastifyReply,
	): Promise<any> {
		const userId = request.params.user;

		const sinceId = request.query.since_id;
		if (sinceId != null && typeof sinceId !== 'string') {
			reply.code(400);
			return;
		}

		const untilId = request.query.until_id;
		if (untilId != null && typeof untilId !== 'string') {
			reply.code(400);
			return;
		}

		const page = request.query.page === 'true';

		if (sinceId != null && untilId != null) {
			reply.code(400);
			return;
		}

		const user = await this.prismaService.client.user.findUnique({
			where: {
				id: userId,
				host: null,
			},
		});

		if (user == null) {
			reply.code(404);
			return;
		}

		const limit = 20;
		const partOf = `${this.configLoaderService.data.url}/users/${userId}/outbox`;

		if (page) {
			const paginationQuery = this.prismaQueryService.getPaginationQuery({ sinceId, untilId });

			const notes = await this.prismaService.client.note.findMany({
				where: {
					AND: [
						paginationQuery.where,
						{ userId: user.id },
						{ OR: [{ visibility: 'public' }, { visibility: 'home' }] },
						{ localOnly: false },
					]
				},
				take: limit,
			});

			if (sinceId) notes.reverse();

			const activities = await Promise.all(notes.map(note => this.packActivity(note)));
			const rendered = this.apRendererService.renderOrderedCollectionPage(
				`${partOf}?${url.query({
					page: 'true',
					since_id: sinceId,
					until_id: untilId,
				})}`,
				user.notesCount, activities, partOf,
				notes.length ? `${partOf}?${url.query({
					page: 'true',
					since_id: notes[0].id,
				})}` : undefined,
				notes.length ? `${partOf}?${url.query({
					page: 'true',
					until_id: notes.at(-1)!.id,
				})}` : undefined,
			);

			this.setResponseType(request, reply);
			return (this.apRendererService.addContext(rendered));
		} else {
			// index page
			const rendered = this.apRendererService.renderOrderedCollection(
				partOf,
				user.notesCount,
				`${partOf}?page=true`,
				`${partOf}?page=true&since_id=000000000000000000000000`,
			);
			reply.header('Cache-Control', 'public, max-age=180');
			this.setResponseType(request, reply);
			return (this.apRendererService.addContext(rendered));
		}
	}

	private async userInfo(request: FastifyRequest, reply: FastifyReply, user: user | null): Promise<any> {
		if (user == null) {
			reply.code(404);
			return;
		}

		reply.header('Cache-Control', 'public, max-age=180');
		this.setResponseType(request, reply);
		return (this.apRendererService.addContext(await this.apRendererService.renderPerson(user as LocalUser)));
	}

	public createServer(fastify: FastifyInstance, options: FastifyPluginOptions, done: (err?: Error) => void): void {
		// addConstraintStrategy の型定義がおかしいため
		(fastify.addConstraintStrategy as any)({
			name: 'apOrHtml',
			storage() {
				const store = {} as any;
				return {
					get(key: string): any {
						return store[key] ?? null;
					},
					set(key: string, value: any): void {
						store[key] = value;
					},
				};
			},
			deriveConstraint(request: IncomingMessage) {
				const accepted = accepts(request).type(['html', ACTIVITY_JSON, LD_JSON]);
				const isAp = typeof accepted === 'string' && !accepted.match(/html/);
				return isAp ? 'ap' : 'html';
			},
		});

		fastify.register(fastifyAccepts);
		fastify.addContentTypeParser('application/activity+json', { parseAs: 'string' }, fastify.getDefaultJsonParser('ignore', 'ignore'));
		fastify.addContentTypeParser('application/ld+json', { parseAs: 'string' }, fastify.getDefaultJsonParser('ignore', 'ignore'));

		fastify.addHook('onRequest', (request, reply, done) => {
			reply.header('Access-Control-Allow-Headers', 'Accept');
			reply.header('Access-Control-Allow-Methods', 'GET, OPTIONS');
			reply.header('Access-Control-Allow-Origin', '*');
			reply.header('Access-Control-Expose-Headers', 'Vary');
			done();
		});

		//#region Routing
		// inbox (limit: 64kb)
		fastify.post('/inbox', { bodyLimit: 1024 * 64 }, async (request, reply) => await this.inbox(request, reply));
		fastify.post('/users/:user/inbox', { bodyLimit: 1024 * 64 }, async (request, reply) => await this.inbox(request, reply));

		// note
		fastify.get<{ Params: { note: string; } }>('/notes/:note', { constraints: { apOrHtml: 'ap' } }, async (request, reply) => {
			vary(reply.raw, 'Accept');

			const note = await this.prismaService.client.note.findUnique({
				where: {
					id: request.params.note,
					visibility: { in:  ['public', 'home'] },
					localOnly: false,
				},
			});

			if (note == null) {
				reply.code(404);
				return;
			}

			// リモートだったらリダイレクト
			if (note.userHost != null) {
				if (note.uri == null || this.utilityService.isSelfHost(note.userHost)) {
					reply.code(500);
					return;
				}
				reply.redirect(note.uri);
				return;
			}

			reply.header('Cache-Control', 'public, max-age=180');
			this.setResponseType(request, reply);
			return this.apRendererService.addContext(await this.apRendererService.renderNote(note, false));
		});

		// note activity
		fastify.get<{ Params: { note: string; } }>('/notes/:note/activity', async (request, reply) => {
			vary(reply.raw, 'Accept');

			const note = await this.prismaService.client.note.findUnique({
				where: {
					id: request.params.note,
					userHost: null,
					visibility: { in: ['public', 'home'] },
					localOnly: false,
				},
			});

			if (note == null) {
				reply.code(404);
				return;
			}

			reply.header('Cache-Control', 'public, max-age=180');
			this.setResponseType(request, reply);
			return (this.apRendererService.addContext(await this.packActivity(note)));
		});

		// outbox
		fastify.get<{
			Params: { user: string; };
			Querystring: { since_id?: string; until_id?: string; page?: string; };
		}>('/users/:user/outbox', async (request, reply) => await this.outbox(request, reply));

		// followers
		fastify.get<{
			Params: { user: string; };
			Querystring: { cursor?: string; page?: string; };
		}>('/users/:user/followers', async (request, reply) => await this.followers(request, reply));

		// following
		fastify.get<{
			Params: { user: string; };
			Querystring: { cursor?: string; page?: string; };
		}>('/users/:user/following', async (request, reply) => await this.following(request, reply));

		// featured
		fastify.get<{ Params: { user: string; }; }>('/users/:user/collections/featured', async (request, reply) => await this.featured(request, reply));

		// publickey
		fastify.get<{ Params: { user: string; } }>('/users/:user/publickey', async (request, reply) => {
			const userId = request.params.user;

			const user = await this.prismaService.client.user.findUnique({
				where: {
					id: userId,
					host: null,
				},
			});

			if (user == null) {
				reply.code(404);
				return;
			}

			const keypair = await this.userKeypairService.getUserKeypair(user.id);

			if (this.userEntityService.isLocalUser(user)) {
				reply.header('Cache-Control', 'public, max-age=180');
				this.setResponseType(request, reply);
				return (this.apRendererService.addContext(this.apRendererService.renderKey(user, keypair)));
			} else {
				reply.code(400);
				return;
			}
		});

		fastify.get<{ Params: { user: string; } }>('/users/:user', { constraints: { apOrHtml: 'ap' } }, async (request, reply) => {
			const userId = request.params.user;

			const user = await this.prismaService.client.user.findUnique({
				where: {
					id: userId,
					host: null,
					isSuspended: false,
				},
			});

			return await this.userInfo(request, reply, user);
		});

		fastify.get<{ Params: { user: string; } }>('/@:user', { constraints: { apOrHtml: 'ap' } }, async (request, reply) => {
			const user = await this.prismaService.client.user.findFirst({
				where: {
					usernameLower: request.params.user.toLowerCase(),
					host: null,
					isSuspended: false,
				},
			});

			return await this.userInfo(request, reply, user);
		});
		//#endregion

		// emoji
		fastify.get<{ Params: { emoji: string; } }>('/emojis/:emoji', async (request, reply) => {
			const emoji = await this.prismaService.client.emoji.findFirst({
				where: {
					host: null,
					name: request.params.emoji,
				},
			});

			if (emoji == null || emoji.localOnly) {
				reply.code(404);
				return;
			}

			reply.header('Cache-Control', 'public, max-age=180');
			this.setResponseType(request, reply);
			return (this.apRendererService.addContext(await this.apRendererService.renderEmoji(emoji)));
		});

		// like
		fastify.get<{ Params: { like: string; } }>('/likes/:like', async (request, reply) => {
			const reaction = await this.prismaService.client.note_reaction.findUnique({ where: { id: request.params.like } });

			if (reaction == null) {
				reply.code(404);
				return;
			}

			const note = await this.prismaService.client.note.findUnique({ where: { id: reaction.noteId } });

			if (note == null) {
				reply.code(404);
				return;
			}

			reply.header('Cache-Control', 'public, max-age=180');
			this.setResponseType(request, reply);
			return (this.apRendererService.addContext(await this.apRendererService.renderLike(reaction, note)));
		});

		// follow
		fastify.get<{ Params: { follower: string; followee: string; } }>('/follows/:follower/:followee', async (request, reply) => {
			// This may be used before the follow is completed, so we do not
			// check if the following exists.

			const [follower, followee] = await Promise.all([
				this.prismaService.client.user.findUnique({
					where: {
						id: request.params.follower,
						host: null,
					},
				}),
				this.prismaService.client.user.findUnique({
					where: {
						id: request.params.followee,
						host: { not: null },
					},
				}),
			]) as [LocalUser | RemoteUser | null, LocalUser | RemoteUser | null];

			if (follower == null || followee == null) {
				reply.code(404);
				return;
			}

			reply.header('Cache-Control', 'public, max-age=180');
			this.setResponseType(request, reply);
			return (this.apRendererService.addContext(this.apRendererService.renderFollow(follower, followee)));
		});

		// follow
		fastify.get<{ Params: { followRequestId: string ; } }>('/follows/:followRequestId', async (request, reply) => {
			// This may be used before the follow is completed, so we do not
			// check if the following exists and only check if the follow request exists.

			const followRequest = await this.prismaService.client.follow_request.findUnique({
				where: {
					id: request.params.followRequestId,
				},
			});

			if (followRequest == null) {
				reply.code(404);
				return;
			}

			const [follower, followee] = await Promise.all([
				this.prismaService.client.user.findUnique({
					where: {
						id: followRequest.followerId,
						host: null,
					},
				}),
				this.prismaService.client.user.findUnique({
					where: {
						id: followRequest.followeeId,
						host: { not: null },
					},
				}),
			]) as [LocalUser | RemoteUser | null, LocalUser | RemoteUser | null];

			if (follower == null || followee == null) {
				reply.code(404);
				return;
			}

			reply.header('Cache-Control', 'public, max-age=180');
			this.setResponseType(request, reply);
			return (this.apRendererService.addContext(this.apRendererService.renderFollow(follower, followee)));
		});

		done();
	}
}
