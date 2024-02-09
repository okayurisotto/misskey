import { Injectable } from '@nestjs/common';
import type { LocalUser, RemoteUser } from '@/models/entities/User.js';
import { InstanceActorService } from '@/core/InstanceActorService.js';
import type { Config } from '@/ConfigLoaderService.js';
import { MetaService } from '@/core/MetaService.js';
import { HttpRequestService } from '@/core/HttpRequestService.js';
import { UtilityService } from '@/core/UtilityService.js';
import { PrismaService } from '@/core/PrismaService.js';
import { ConfigLoaderService } from '@/ConfigLoaderService.js';
import { isCollectionOrOrderedCollection } from './type.js';
import { ApRendererService } from './ApRendererService.js';
import { ApRequestService } from './ApRequestService.js';
import { ApUriParseService } from './ApUriParseService.js';
import type { IObject, ICollection, IOrderedCollection } from './type.js';

export class Resolver {
	private readonly history: Set<string>;
	private user?: LocalUser;

	constructor(
		private readonly config: Config,

		private readonly utilityService: UtilityService,
		private readonly instanceActorService: InstanceActorService,
		private readonly metaService: MetaService,
		private readonly apRequestService: ApRequestService,
		private readonly httpRequestService: HttpRequestService,
		private readonly apRendererService: ApRendererService,
		private readonly prismaService: PrismaService,
		private readonly apUriParseService: ApUriParseService,
		private readonly recursionLimit = 100,
	) {
		this.history = new Set();
	}

	public getHistory(): string[] {
		return Array.from(this.history);
	}

	public async resolveCollection(
		value: string | IObject,
	): Promise<ICollection | IOrderedCollection> {
		const collection =
			typeof value === 'string' ? await this.resolve(value) : value;

		if (isCollectionOrOrderedCollection(collection)) {
			return collection;
		} else {
			throw new Error(`unrecognized collection type: ${collection.type}`);
		}
	}

	public async resolve(value: string | IObject): Promise<IObject> {
		if (typeof value !== 'string') {
			return value;
		}

		if (value.includes('#')) {
			// URLs with fragment parts cannot be resolved correctly because
			// the fragment part does not get transmitted over HTTP(S).
			// Avoid strange behaviour by not trying to resolve these at all.
			throw new Error(`cannot resolve URL with fragment: ${value}`);
		}

		if (this.history.has(value)) {
			throw new Error('cannot resolve already resolved one');
		}

		if (this.history.size > this.recursionLimit) {
			throw new Error(
				`hit recursion limit: ${this.utilityService.extractDbHost(value)}`,
			);
		}

		this.history.add(value);

		const host = this.utilityService.extractDbHost(value);
		if (this.utilityService.isSelfHost(host)) {
			return await this.resolveLocal(value);
		}

		const meta = await this.metaService.fetch();
		if (this.utilityService.isBlockedHost(meta.blockedHosts, host)) {
			throw new Error('Instance is blocked');
		}

		if (this.config.signToActivityPubGet && !this.user) {
			this.user = await this.instanceActorService.getInstanceActor();
		}

		const object = (
			this.user
				? await this.apRequestService.signedGet(value, this.user)
				: await this.httpRequestService.getJson(
						value,
						'application/activity+json, application/ld+json',
				  )
		) as IObject;

		if (
			Array.isArray(object['@context'])
				? !(object['@context'] as unknown[]).includes(
						'https://www.w3.org/ns/activitystreams',
				  )
				: object['@context'] !== 'https://www.w3.org/ns/activitystreams'
		) {
			throw new Error('invalid response');
		}

		return object;
	}

	private resolveLocal(url: string): Promise<IObject> {
		const parsed = this.apUriParseService.parse(url);
		if (!parsed.local) throw new Error('resolveLocal: not local');

		switch (parsed.type) {
			case 'notes':
				return this.prismaService.client.note
					.findUniqueOrThrow({ where: { id: parsed.id } })
					.then(async (note) => {
						if (parsed.rest === 'activity') {
							// this refers to the create activity and not the note itself
							return this.apRendererService.addContext(
								this.apRendererService.renderCreate(
									await this.apRendererService.renderNote(note),
									note,
								),
							);
						} else {
							return this.apRendererService.renderNote(note);
						}
					});
			case 'users':
				return this.prismaService.client.user
					.findUniqueOrThrow({ where: { id: parsed.id } })
					.then((user) =>
						this.apRendererService.renderPerson(user as LocalUser),
					);
			case 'questions':
				// Polls are indexed by the note they are attached to.
				return Promise.all([
					this.prismaService.client.note.findUniqueOrThrow({
						where: { id: parsed.id },
					}),
					this.prismaService.client.poll.findUniqueOrThrow({
						where: { noteId: parsed.id },
					}),
				]).then(([note, poll]) =>
					this.apRendererService.renderQuestion(
						{ id: note.userId },
						note,
						poll,
					),
				);
			case 'likes':
				return this.prismaService.client.noteReaction
					.findUniqueOrThrow({ where: { id: parsed.id } })
					.then(async (reaction) =>
						this.apRendererService.addContext(
							await this.apRendererService.renderLike(reaction, { uri: null }),
						),
					);
			case 'follows':
				// rest should be <followee id>
				if (parsed.rest == null || !/^\w+$/.test(parsed.rest))
					throw new Error('resolveLocal: invalid follow URI');

				return Promise.all(
					[parsed.id, parsed.rest].map((id) =>
						this.prismaService.client.user.findUniqueOrThrow({ where: { id } }),
					),
				).then(([follower, followee]) =>
					this.apRendererService.addContext(
						this.apRendererService.renderFollow(
							follower as LocalUser | RemoteUser,
							followee as LocalUser | RemoteUser,
							url,
						),
					),
				);
			default:
				throw new Error(`resolveLocal: type ${parsed.type} unhandled`);
		}
	}
}

@Injectable()
export class ApResolverService {
	constructor(
		private readonly apRendererService: ApRendererService,
		private readonly apRequestService: ApRequestService,
		private readonly apUriParseService: ApUriParseService,
		private readonly configLoaderService: ConfigLoaderService,
		private readonly httpRequestService: HttpRequestService,
		private readonly instanceActorService: InstanceActorService,
		private readonly metaService: MetaService,
		private readonly prismaService: PrismaService,
		private readonly utilityService: UtilityService,
	) {}

	public createResolver(): Resolver {
		return new Resolver(
			this.configLoaderService.data,
			this.utilityService,
			this.instanceActorService,
			this.metaService,
			this.apRequestService,
			this.httpRequestService,
			this.apRendererService,
			this.prismaService,
			this.apUriParseService,
		);
	}
}
