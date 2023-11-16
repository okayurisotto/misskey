import { createPublicKey, randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import * as mfm from 'mfm-js';
import { z } from 'zod';
import type { PartialLocalUser, LocalUser, PartialRemoteUser, RemoteUser } from '@/models/entities/User.js';
import type { IMentionedRemoteUsers } from '@/models/entities/Note.js';
import { UserKeypairService } from '@/core/UserKeypairService.js';
import { MfmService } from '@/core/MfmService.js';
import { UserEntityService } from '@/core/entities/UserEntityService.js';
import { DriveFileEntityService } from '@/core/entities/DriveFileEntityService.js';
import { bindThis } from '@/decorators.js';
import { CustomEmojiService } from '@/core/CustomEmojiService.js';
import { isNotNull } from '@/misc/is-not-null.js';
import { PrismaService } from '@/core/PrismaService.js';
import { ConfigLoaderService } from '@/ConfigLoaderService.js';
import { LdSignatureService } from './LdSignatureService.js';
import { ApMfmService } from './ApMfmService.js';
import type { IAccept, IActivity, IAdd, IAnnounce, IApDocument, IApEmoji, IApHashtag, IApImage, IApMention, IBlock, ICreate, IDelete, IFlag, IFollow, IKey, ILike, IMove, IObject, IPost, IQuestion, IReject, IRemove, ITombstone, IUndo, IUpdate } from './type.js';
import type { relay, note_reaction, emoji, blocking, drive_file, note, poll, poll_vote, user, user_keypair } from '@prisma/client';

export type AddContext<T extends IObject> = T & { '@context': any; id: string };

@Injectable()
export class ApRendererService {
	constructor(
		private readonly configLoaderService: ConfigLoaderService,

		private readonly customEmojiService: CustomEmojiService,
		private readonly userEntityService: UserEntityService,
		private readonly driveFileEntityService: DriveFileEntityService,
		private readonly ldSignatureService: LdSignatureService,
		private readonly userKeypairService: UserKeypairService,
		private readonly apMfmService: ApMfmService,
		private readonly mfmService: MfmService,
		private readonly prismaService: PrismaService,
	) {}

	@bindThis
	public renderAccept(object: string | IObject, user: { id: user['id']; host: null }): IAccept {
		return {
			type: 'Accept',
			actor: this.userEntityService.genLocalUserUri(user.id),
			object,
		};
	}

	@bindThis
	public renderAdd(user: LocalUser, target: string | IObject | undefined, object: string | IObject): IAdd {
		return {
			type: 'Add',
			actor: this.userEntityService.genLocalUserUri(user.id),
			target,
			object,
		};
	}

	@bindThis
	public renderAnnounce(object: string | IObject, note: note): IAnnounce {
		const attributedTo = this.userEntityService.genLocalUserUri(note.userId);

		let to: string[] = [];
		let cc: string[] = [];

		if (note.visibility === 'public') {
			to = ['https://www.w3.org/ns/activitystreams#Public'];
			cc = [`${attributedTo}/followers`];
		} else if (note.visibility === 'home') {
			to = [`${attributedTo}/followers`];
			cc = ['https://www.w3.org/ns/activitystreams#Public'];
		} else if (note.visibility === 'followers') {
			to = [`${attributedTo}/followers`];
			cc = [];
		} else {
			throw new Error('renderAnnounce: cannot render non-public note');
		}

		return {
			id: `${this.configLoaderService.data.url}/notes/${note.id}/activity`,
			actor: this.userEntityService.genLocalUserUri(note.userId),
			type: 'Announce',
			published: note.createdAt.toISOString(),
			to,
			cc,
			object,
		};
	}

	/**
	 * Renders a block into its ActivityPub representation.
	 *
	 * @param block The block to be rendered. The blockee relation must be loaded.
	 */
	@bindThis
	public renderBlock(block: blocking & { blockee: user }): IBlock {
		if (block.blockee.uri == null) {
			throw new Error('renderBlock: missing blockee uri');
		}

		return {
			type: 'Block',
			id: `${this.configLoaderService.data.url}/blocks/${block.id}`,
			actor: this.userEntityService.genLocalUserUri(block.blockerId),
			object: block.blockee.uri,
		};
	}

	@bindThis
	public renderCreate(object: IObject, note: note): ICreate {
		const activity: ICreate = {
			id: `${this.configLoaderService.data.url}/notes/${note.id}/activity`,
			actor: this.userEntityService.genLocalUserUri(note.userId),
			type: 'Create',
			published: note.createdAt.toISOString(),
			object,
		};

		if (object.to) activity.to = object.to;
		if (object.cc) activity.cc = object.cc;

		return activity;
	}

	@bindThis
	public renderDelete(object: IObject | string, user: { id: user['id']; host: null }): IDelete {
		return {
			type: 'Delete',
			actor: this.userEntityService.genLocalUserUri(user.id),
			object,
			published: new Date().toISOString(),
		};
	}

	@bindThis
	public renderDocument(file: drive_file): IApDocument {
		return {
			type: 'Document',
			mediaType: file.webpublicType ?? file.type,
			url: this.driveFileEntityService.getPublicUrl(file),
			name: file.comment,
		};
	}

	@bindThis
	public renderEmoji(emoji: emoji): IApEmoji {
		return {
			id: `${this.configLoaderService.data.url}/emojis/${emoji.name}`,
			type: 'Emoji',
			name: `:${emoji.name}:`,
			updated: emoji.updatedAt != null ? emoji.updatedAt.toISOString() : new Date().toISOString(),
			icon: {
				type: 'Image',
				mediaType: emoji.type ?? 'image/png',
				// || emoji.originalUrl してるのは後方互換性のため（publicUrlはstringなので??はだめ）
				url: emoji.publicUrl || emoji.originalUrl,
			},
		};
	}

	// to anonymise reporters, the reporting actor must be a system user
	@bindThis
	public renderFlag(user: LocalUser, object: IObject | string, content: string): IFlag {
		return {
			type: 'Flag',
			actor: this.userEntityService.genLocalUserUri(user.id),
			content,
			object,
		};
	}

	@bindThis
	public renderFollowRelay(relay: relay, relayActor: LocalUser): IFollow {
		return {
			id: `${this.configLoaderService.data.url}/activities/follow-relay/${relay.id}`,
			type: 'Follow',
			actor: this.userEntityService.genLocalUserUri(relayActor.id),
			object: 'https://www.w3.org/ns/activitystreams#Public',
		};
	}

	/**
	 * Convert (local|remote)(Follower|Followee)ID to URL
	 * @param id Follower|Followee ID
	 */
	@bindThis
	public async renderFollowUser(id: user['id']): Promise<string> {
		const user = await this.prismaService.client.user.findUniqueOrThrow({ where: { id: id } }) as PartialLocalUser | PartialRemoteUser;
		return this.userEntityService.getUserUri(user);
	}

	@bindThis
	public renderFollow(
		follower: PartialLocalUser | PartialRemoteUser,
		followee: PartialLocalUser | PartialRemoteUser,
		requestId?: string,
	): IFollow {
		return {
			id: requestId ?? `${this.configLoaderService.data.url}/follows/${follower.id}/${followee.id}`,
			type: 'Follow',
			actor: this.userEntityService.getUserUri(follower),
			object: this.userEntityService.getUserUri(followee),
		};
	}

	@bindThis
	public renderHashtag(tag: string): IApHashtag {
		return {
			type: 'Hashtag',
			href: `${this.configLoaderService.data.url}/tags/${encodeURIComponent(tag)}`,
			name: `#${tag}`,
		};
	}

	@bindThis
	public renderImage(file: drive_file): IApImage {
		return {
			type: 'Image',
			url: this.driveFileEntityService.getPublicUrl(file),
			sensitive: file.isSensitive,
			name: file.comment,
		};
	}

	@bindThis
	public renderKey(user: LocalUser, key: user_keypair, postfix?: string): IKey {
		return {
			id: `${this.configLoaderService.data.url}/users/${user.id}${postfix ?? '/publickey'}`,
			type: 'Key',
			owner: this.userEntityService.genLocalUserUri(user.id),
			publicKeyPem: createPublicKey(key.publicKey).export({
				type: 'spki',
				format: 'pem',
			}),
		};
	}

	@bindThis
	public async renderLike(noteReaction: note_reaction, note: { uri: string | null }): Promise<ILike> {
		const reaction = noteReaction.reaction;

		const object: ILike = {
			type: 'Like',
			id: `${this.configLoaderService.data.url}/likes/${noteReaction.id}`,
			actor: `${this.configLoaderService.data.url}/users/${noteReaction.userId}`,
			object: note.uri ? note.uri : `${this.configLoaderService.data.url}/notes/${noteReaction.noteId}`,
			content: reaction,
			_misskey_reaction: reaction,
		};

		if (reaction.startsWith(':')) {
			const name = reaction.replaceAll(':', '');
			const emoji = (await this.customEmojiService.localEmojisCache.fetch()).get(name);

			if (emoji && !emoji.localOnly) object.tag = [this.renderEmoji(emoji)];
		}

		return object;
	}

	@bindThis
	public renderMention(mention: PartialLocalUser | PartialRemoteUser): IApMention {
		return {
			type: 'Mention',
			href: this.userEntityService.getUserUri(mention),
			name: this.userEntityService.isRemoteUser(mention) ? `@${mention.username}@${mention.host}` : `@${(mention as LocalUser).username}`,
		};
	}

	@bindThis
	public renderMove(
		src: PartialLocalUser | PartialRemoteUser,
		dst: PartialLocalUser | PartialRemoteUser,
	): IMove {
		const actor = this.userEntityService.getUserUri(src);
		const target = this.userEntityService.getUserUri(dst);
		return {
			id: `${this.configLoaderService.data.url}/moves/${src.id}/${dst.id}`,
			actor,
			type: 'Move',
			object: actor,
			target,
		};
	}

	@bindThis
	public async renderNote(note: note, dive = true): Promise<IPost> {
		const getPromisedFiles = async (ids: string[]): Promise<drive_file[]> => {
			if (ids.length === 0) return [];
			const items = await this.prismaService.client.drive_file.findMany({ where: { id: { in: ids } } });
			return ids.map(id => items.find(item => item.id === id)).filter((item): item is drive_file => item != null);
		};

		let inReplyTo;
		let inReplyToNote: note | null;

		if (note.replyId) {
			inReplyToNote = await this.prismaService.client.note.findUnique({ where: { id: note.replyId } });

			if (inReplyToNote != null) {
				const inReplyToUserExist = (await this.prismaService.client.user.count({
					where: { id: inReplyToNote.userId },
					take: 1,
				})) > 0;

				if (inReplyToUserExist) {
					if (inReplyToNote.uri) {
						inReplyTo = inReplyToNote.uri;
					} else {
						if (dive) {
							inReplyTo = await this.renderNote(inReplyToNote, false);
						} else {
							inReplyTo = `${this.configLoaderService.data.url}/notes/${inReplyToNote.id}`;
						}
					}
				}
			}
		} else {
			inReplyTo = null;
		}

		let quote;

		if (note.renoteId) {
			const renote = await this.prismaService.client.note.findUnique({ where: { id: note.renoteId } });

			if (renote) {
				quote = renote.uri ? renote.uri : `${this.configLoaderService.data.url}/notes/${renote.id}`;
			}
		}

		const attributedTo = this.userEntityService.genLocalUserUri(note.userId);

		const mentions = (JSON.parse(note.mentionedRemoteUsers) as IMentionedRemoteUsers).map(x => x.uri);

		let to: string[] = [];
		let cc: string[] = [];

		if (note.visibility === 'public') {
			to = ['https://www.w3.org/ns/activitystreams#Public'];
			cc = [`${attributedTo}/followers`].concat(mentions);
		} else if (note.visibility === 'home') {
			to = [`${attributedTo}/followers`];
			cc = ['https://www.w3.org/ns/activitystreams#Public'].concat(mentions);
		} else if (note.visibility === 'followers') {
			to = [`${attributedTo}/followers`];
			cc = mentions;
		} else {
			to = mentions;
		}

		const mentionedUsers = note.mentions.length > 0
			? await this.prismaService.client.user.findMany({ where: { id: { in: note.mentions } } })
			: [];

		const hashtagTags = note.tags.map(tag => this.renderHashtag(tag));
		const mentionTags = mentionedUsers.map(u => this.renderMention(u as LocalUser | RemoteUser));

		const files = await getPromisedFiles(note.fileIds);

		const text = note.text ?? '';
		let poll: poll | null = null;

		if (note.hasPoll) {
			poll = await this.prismaService.client.poll.findUnique({ where: { noteId: note.id } });
		}

		let apText = text;

		if (quote) {
			apText += `\n\nRE: ${quote}`;
		}

		const summary = note.cw === '' ? String.fromCharCode(0x200B) : note.cw;

		const content = this.apMfmService.getNoteHtml(Object.assign({}, note, {
			text: apText,
		}));

		const emojis = await this.getEmojis(note.emojis);
		const apemojis = emojis.filter(emoji => !emoji.localOnly).map(emoji => this.renderEmoji(emoji));

		const tag = [
			...hashtagTags,
			...mentionTags,
			...apemojis,
		];

		const asPoll = poll ? {
			type: 'Question',
			content: this.apMfmService.getNoteHtml(Object.assign({}, note, {
				text: text,
			})),
			[poll.expiresAt && poll.expiresAt < new Date() ? 'closed' : 'endTime']: poll.expiresAt,
			[poll.multiple ? 'anyOf' : 'oneOf']: poll.choices.map((text, i) => ({
				type: 'Note',
				name: text,
				replies: {
					type: 'Collection',
					totalItems: poll!.votes[i],
				},
			})),
		} as const : {};

		return {
			id: `${this.configLoaderService.data.url}/notes/${note.id}`,
			type: 'Note',
			attributedTo,
			summary: summary ?? undefined,
			content: content ?? undefined,
			_misskey_content: text,
			source: {
				content: text,
				mediaType: 'text/x.misskeymarkdown',
			},
			_misskey_quote: quote,
			quoteUrl: quote,
			published: note.createdAt.toISOString(),
			to,
			cc,
			inReplyTo,
			attachment: files.map(x => this.renderDocument(x)),
			sensitive: note.cw != null || files.some(file => file.isSensitive),
			tag,
			...asPoll,
		};
	}

	@bindThis
	public async renderPerson(user: LocalUser): Promise<any> {
		const id = this.userEntityService.genLocalUserUri(user.id);
		const isSystem = user.username.includes('.');

		const [avatar, banner, profile] = await Promise.all([
			user.avatarId ? this.prismaService.client.drive_file.findUnique({ where: { id: user.avatarId } }) : undefined,
			user.bannerId ? this.prismaService.client.drive_file.findUnique({ where: { id: user.bannerId } }) : undefined,
			this.prismaService.client.user_profile.findUniqueOrThrow({ where: { userId: user.id } }),
		]);

		const attachment = z.array(z.object({ name: z.string(), value: z.string() })).parse(profile.fields).map(field => ({
			type: 'PropertyValue',
			name: field.name,
			value: /^https?:/.test(field.value)
				? `<a href="${new URL(field.value).href}" rel="me nofollow noopener" target="_blank">${new URL(field.value).href}</a>`
				: field.value,
		}));

		const emojis = await this.getEmojis(user.emojis);
		const apemojis = emojis.filter(emoji => !emoji.localOnly).map(emoji => this.renderEmoji(emoji));

		const hashtagTags = user.tags.map(tag => this.renderHashtag(tag));

		const tag = [
			...apemojis,
			...hashtagTags,
		];

		const keypair = await this.userKeypairService.getUserKeypair(user.id);

		const person: any = {
			type: isSystem ? 'Application' : user.isBot ? 'Service' : 'Person',
			id,
			inbox: `${id}/inbox`,
			outbox: `${id}/outbox`,
			followers: `${id}/followers`,
			following: `${id}/following`,
			featured: `${id}/collections/featured`,
			sharedInbox: `${this.configLoaderService.data.url}/inbox`,
			endpoints: { sharedInbox: `${this.configLoaderService.data.url}/inbox` },
			url: `${this.configLoaderService.data.url}/@${user.username}`,
			preferredUsername: user.username,
			name: user.name,
			summary: profile.description ? this.mfmService.toHtml(mfm.parse(profile.description)) : null,
			icon: avatar ? this.renderImage(avatar) : null,
			image: banner ? this.renderImage(banner) : null,
			tag,
			manuallyApprovesFollowers: user.isLocked,
			discoverable: user.isExplorable,
			publicKey: this.renderKey(user, keypair, '#main-key'),
			isCat: user.isCat,
			attachment: attachment.length ? attachment : undefined,
		};

		if (user.movedToUri) {
			person.movedTo = user.movedToUri;
		}

		if (user.alsoKnownAs) {
			person.alsoKnownAs = user.alsoKnownAs;
		}

		if (profile.birthday) {
			person['vcard:bday'] = profile.birthday;
		}

		if (profile.location) {
			person['vcard:Address'] = profile.location;
		}

		return person;
	}

	@bindThis
	public renderQuestion(user: { id: user['id'] }, note: note, poll: poll): IQuestion {
		return {
			type: 'Question',
			id: `${this.configLoaderService.data.url}/questions/${note.id}`,
			actor: this.userEntityService.genLocalUserUri(user.id),
			content: note.text ?? '',
			[poll.multiple ? 'anyOf' : 'oneOf']: poll.choices.map((text, i) => ({
				name: text,
				_misskey_votes: poll.votes[i],
				replies: {
					type: 'Collection',
					totalItems: poll.votes[i],
				},
			})),
		};
	}

	@bindThis
	public renderReject(object: string | IObject, user: { id: user['id'] }): IReject {
		return {
			type: 'Reject',
			actor: this.userEntityService.genLocalUserUri(user.id),
			object,
		};
	}

	@bindThis
	public renderRemove(user: { id: user['id'] }, target: string | IObject | undefined, object: string | IObject): IRemove {
		return {
			type: 'Remove',
			actor: this.userEntityService.genLocalUserUri(user.id),
			target,
			object,
		};
	}

	@bindThis
	public renderTombstone(id: string): ITombstone {
		return {
			id,
			type: 'Tombstone',
		};
	}

	@bindThis
	public renderUndo(object: string | IObject, user: { id: user['id'] }): IUndo {
		const id = typeof object !== 'string' && typeof object.id === 'string' && object.id.startsWith(this.configLoaderService.data.url) ? `${object.id}/undo` : undefined;

		return {
			type: 'Undo',
			...(id ? { id } : {}),
			actor: this.userEntityService.genLocalUserUri(user.id),
			object,
			published: new Date().toISOString(),
		};
	}

	@bindThis
	public renderUpdate(object: string | IObject, user: { id: user['id'] }): IUpdate {
		return {
			id: `${this.configLoaderService.data.url}/users/${user.id}#updates/${new Date().getTime()}`,
			actor: this.userEntityService.genLocalUserUri(user.id),
			type: 'Update',
			to: ['https://www.w3.org/ns/activitystreams#Public'],
			object,
			published: new Date().toISOString(),
		};
	}

	@bindThis
	public renderVote(user: { id: user['id'] }, vote: poll_vote, note: note, poll: poll, pollOwner: RemoteUser): ICreate {
		return {
			id: `${this.configLoaderService.data.url}/users/${user.id}#votes/${vote.id}/activity`,
			actor: this.userEntityService.genLocalUserUri(user.id),
			type: 'Create',
			to: [pollOwner.uri],
			published: new Date().toISOString(),
			object: {
				id: `${this.configLoaderService.data.url}/users/${user.id}#votes/${vote.id}`,
				type: 'Note',
				attributedTo: this.userEntityService.genLocalUserUri(user.id),
				to: [pollOwner.uri],
				inReplyTo: note.uri,
				name: poll.choices[vote.choice],
			},
		};
	}

	@bindThis
	public addContext<T extends IObject>(x: T): AddContext<T> {
		if (typeof x === 'object' && x.id == null) {
			x.id = `${this.configLoaderService.data.url}/${randomUUID()}`;
		}

		return Object.assign({
			'@context': [
				'https://www.w3.org/ns/activitystreams',
				'https://w3id.org/security/v1',
				{
					// as non-standards
					manuallyApprovesFollowers: 'as:manuallyApprovesFollowers',
					sensitive: 'as:sensitive',
					Hashtag: 'as:Hashtag',
					quoteUrl: 'as:quoteUrl',
					// Mastodon
					toot: 'http://joinmastodon.org/ns#',
					Emoji: 'toot:Emoji',
					featured: 'toot:featured',
					discoverable: 'toot:discoverable',
					// schema
					schema: 'http://schema.org#',
					PropertyValue: 'schema:PropertyValue',
					value: 'schema:value',
					// Misskey
					misskey: 'https://misskey-hub.net/ns#',
					'_misskey_content': 'misskey:_misskey_content',
					'_misskey_quote': 'misskey:_misskey_quote',
					'_misskey_reaction': 'misskey:_misskey_reaction',
					'_misskey_votes': 'misskey:_misskey_votes',
					'isCat': 'misskey:isCat',
					// vcard
					vcard: 'http://www.w3.org/2006/vcard/ns#',
				},
			],
		}, x as T & { id: string });
	}

	@bindThis
	public async attachLdSignature(activity: any, user: { id: user['id']; host: null; }): Promise<IActivity> {
		const keypair = await this.userKeypairService.getUserKeypair(user.id);

		const ldSignature = this.ldSignatureService.use();
		ldSignature.debug = false;
		activity = await ldSignature.signRsaSignature2017(activity, keypair.privateKey, `${this.configLoaderService.data.url}/users/${user.id}#main-key`);

		return activity;
	}

	/**
	 * Render OrderedCollectionPage
	 * @param id URL of self
	 * @param totalItems Number of total items
	 * @param orderedItems Items
	 * @param partOf URL of base
	 * @param prev URL of prev page (optional)
	 * @param next URL of next page (optional)
	 */
	@bindThis
	public renderOrderedCollectionPage(id: string, totalItems: any, orderedItems: any, partOf: string, prev?: string, next?: string): any {
		const page: any = {
			id,
			partOf,
			type: 'OrderedCollectionPage',
			totalItems,
			orderedItems,
		};

		if (prev) page.prev = prev;
		if (next) page.next = next;

		return page;
	}

	/**
	 * Render OrderedCollection
	 * @param id URL of self
	 * @param totalItems Total number of items
	 * @param first URL of first page (optional)
	 * @param last URL of last page (optional)
	 * @param orderedItems attached objects (optional)
	 */
	@bindThis
	public renderOrderedCollection(id: string, totalItems: number, first?: string, last?: string, orderedItems?: IObject[]): any {
		const page: any = {
			id,
			type: 'OrderedCollection',
			totalItems,
		};

		if (first) page.first = first;
		if (last) page.last = last;
		if (orderedItems) page.orderedItems = orderedItems;

		return page;
	}

	@bindThis
	private async getEmojis(names: string[]): Promise<emoji[]> {
		if (names.length === 0) return [];

		const allEmojis = await this.customEmojiService.localEmojisCache.fetch();
		const emojis = names.map(name => allEmojis.get(name)).filter(isNotNull);

		return emojis;
	}
}
