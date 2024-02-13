import * as WebSocket from 'ws';
import { z } from 'zod';
import type { NoteReadService } from '@/core/NoteReadService.js';
import type { NotificationService } from '@/core/NotificationService.js';
import type { NoteSchema } from '@/models/zod/NoteSchema.js';
import { PrismaService } from '@/core/PrismaService.js';
import { channelServiceNames, type ChannelServiceName, type ChannelsService } from './ChannelsService.js';
import type { EventEmitter } from 'events';
import type Channel from './channel.js';
import type { StreamEventEmitter, StreamMessages } from './types.js';
import type { AccessToken, user, user_profile } from '@prisma/client';

/**
 * Main stream connection
 */
// eslint-disable-next-line import/no-default-export
export default class Connection {
	public user?: user;
	public token?: AccessToken;
	private wsConnection: WebSocket.WebSocket;
	public subscriber: StreamEventEmitter;
	private channels: Channel[] = [];
	private subscribingNotes: Record<string | number, number | null | undefined> = {};
	private cachedNotes: z.infer<typeof NoteSchema>[] = [];
	public userProfile: user_profile | null = null;
	public following: Set<string> = new Set();
	public followingChannels: Set<string> = new Set();
	public userIdsWhoMeMuting: Set<string> = new Set();
	public userIdsWhoBlockingMe: Set<string> = new Set();
	public userIdsWhoMeMutingRenotes: Set<string> = new Set();
	private fetchIntervalId: NodeJS.Timer | null = null;

	constructor(
		private readonly channelsService: ChannelsService,
		private readonly noteReadService: NoteReadService,
		private readonly notificationService: NotificationService,
		private readonly prismaService: PrismaService,

		user: user | null | undefined,
		token: AccessToken | null | undefined,
	) {
		if (user) this.user = user;
		if (token) this.token = token;
	}

	public async fetch(): Promise<void> {
		if (this.user == null) return;
		const [userProfile, following, followingChannels, userIdsWhoMeMuting, userIdsWhoBlockingMe, userIdsWhoMeMutingRenotes] = await Promise.all([
			this.prismaService.client.user_profile.findUnique({ where: { userId: this.user.id } }),
			this.prismaService.client.following.findMany({ where: { followerId: this.user.id }, select: { followeeId: true } }),
			this.prismaService.client.channelFollowing.findMany({ where: { userId: this.user.id }, select: { channelId: true } }),
			this.prismaService.client.userMuting.findMany({ where: { muterId: this.user.id }, select: { muteeId: true } }),
			this.prismaService.client.blocking.findMany({ where: { blockeeId: this.user.id }, select: { blockerId: true } }),
			this.prismaService.client.renote_muting.findMany({ where: { muterId: this.user.id }, select: { muteeId: true } }),
		]);
		this.userProfile = userProfile;
		this.following = new Set(following.map(({ followeeId }) => followeeId));
		this.followingChannels = new Set(followingChannels.map(({ channelId }) => channelId));
		this.userIdsWhoMeMuting = new Set(userIdsWhoMeMuting.map(({ muteeId }) => muteeId));
		this.userIdsWhoBlockingMe = new Set(userIdsWhoBlockingMe.map(({ blockerId }) => blockerId));
		this.userIdsWhoMeMutingRenotes = new Set(userIdsWhoMeMutingRenotes.map(({ muteeId }) => muteeId));
	}

	public async init(): Promise<void> {
		if (this.user !== undefined) {
			await this.fetch();

			if (this.fetchIntervalId === null) {
				this.fetchIntervalId = setInterval(async () => {
					await this.fetch();
				}, 1000 * 10);
			}
		}
	}

	public listen(subscriber: EventEmitter, wsConnection: WebSocket.WebSocket): void {
		this.subscriber = subscriber;

		this.wsConnection = wsConnection;
		this.wsConnection.on('message', async (data) => {
			await this.onWsConnectionMessage(data);
		});

		this.subscriber.on('broadcast', data => {
			this.onBroadcastMessage(data);
		});
	}

	/**
	 * クライアントからメッセージ受信時
	 */
	private async onWsConnectionMessage(data: WebSocket.RawData): Promise<void> {
		const MessageSchema = z.discriminatedUnion('type', [
			z.object({
				type: z.literal('readNotification'),
				body: z.unknown(),
			}),
			z.object({
				type: z.enum(['subNote', 's']),
				body: z.object({ id: z.string() }),
			}),
			z.object({
				type: z.literal('sr'),
				body: z.object({ id: z.string() }),
			}),
			z.object({
				type: z.enum(['unsubNote', 'un']),
				body: z.object({ id: z.string().or(z.number()).nullish() }),
			}),
			z.object({
				type: z.literal('connect'),
				body: z.object({ channel: z.enum(channelServiceNames), id: z.string(), params: z.unknown(), pong: z.boolean().optional() }),
			}),
			z.object({
				type: z.literal('disconnect'),
				body: z.object({ id: z.string() }),
			}),
			z.object({
				type: z.enum(['channel', 'ch']),
				body: z.object({ id: z.string(), type: z.string(), body: z.unknown() }),
			}),
		]);

		const message = ((): z.infer<typeof MessageSchema> | null => {
			try {
				// eslint-disable-next-line @typescript-eslint/no-base-to-string
				const json = data.toString();
				return MessageSchema.parse(JSON.parse(json));
			} catch {
				return null;
			}
		})();

		if (message === null) return;

		const { type, body } = message;

		switch (type) {
			case 'readNotification': await this.onReadNotification(); break;
			case 'subNote': this.onSubscribeNote(body); break;
			case 's': this.onSubscribeNote(body); break; // alias
			case 'sr': this.onSubscribeNote(body); await this.readNote(body); break;
			case 'unsubNote': this.onUnsubscribeNote(body); break;
			case 'un': this.onUnsubscribeNote(body); break; // alias
			case 'connect': this.onChannelConnectRequested(body); break;
			case 'disconnect': this.onChannelDisconnectRequested(body); break;
			case 'channel': this.onChannelMessageRequested(body); break;
			case 'ch': this.onChannelMessageRequested(body); break; // alias
		}
	}

	private onBroadcastMessage(data: StreamMessages['broadcast']['payload']): void {
		this.sendMessageToWs(data.type, data.body);
	}

	public cacheNote(note: z.infer<typeof NoteSchema>): void {
		const add = (note: z.infer<typeof NoteSchema>): void => {
			const existIndex = this.cachedNotes.findIndex(n => n.id === note.id);
			if (existIndex > -1) {
				this.cachedNotes[existIndex] = note;
				return;
			}

			this.cachedNotes.unshift(note);
			if (this.cachedNotes.length > 32) {
				this.cachedNotes.splice(32);
			}
		};

		add(note);
		if (note.reply) add(note.reply);
		if (note.renote) add(note.renote);
	}

	private async readNote(body: { id: string }): Promise<void> {
		const id = body.id;

		const note = this.cachedNotes.find(n => n.id === id);
		if (note == null) return;

		if (this.user && (note.userId !== this.user.id)) {
			await this.noteReadService.read(this.user.id, [note]);
		}
	}

	private async onReadNotification(): Promise<void> {
		if (this.user === undefined) throw new Error();
		await this.notificationService.readAllNotification(this.user.id);
	}

	/**
	 * 投稿購読要求時
	 */
	private onSubscribeNote(payload: { id: string | number | null | undefined }): void {
		if (!payload.id) return;

		if (this.subscribingNotes[payload.id] == null) {
			this.subscribingNotes[payload.id] = 0;
		}

		this.subscribingNotes[payload.id]++;

		if (this.subscribingNotes[payload.id] === 1) {
			this.subscriber.on(`noteStream:${payload.id}`, (data) => {
				this.onNoteStreamMessage(data);
			});
		}
	}

	/**
	 * 投稿購読解除要求時
	 */
	private onUnsubscribeNote(payload: { id?: string | number | null | undefined }): void {
		if (!payload.id) return;

		this.subscribingNotes[payload.id]--;
		if (this.subscribingNotes[payload.id] <= 0) {
			delete this.subscribingNotes[payload.id];
			this.subscriber.off(`noteStream:${payload.id}`, (data) => {
				this.onNoteStreamMessage(data);
			});
		}
	}

	private onNoteStreamMessage(data: StreamMessages['note']['payload']): void {
		this.sendMessageToWs('noteUpdated', {
			id: data.body.id,
			type: data.type,
			body: data.body.body,
		});
	}

	/**
	 * チャンネル接続要求時
	 */
	private onChannelConnectRequested(payload: { channel: ChannelServiceName; id: string; params?: unknown; pong?: boolean | undefined }): void {
		const { channel, id, params, pong } = payload;
		this.connectChannel(id, params, channel, pong);
	}

	/**
	 * チャンネル切断要求時
	 */
	private onChannelDisconnectRequested(payload: { id: string }): void {
		const { id } = payload;
		this.disconnectChannel(id);
	}

	/**
	 * クライアントにメッセージ送信
	 */
	public sendMessageToWs(type: string, payload: unknown): void {
		this.wsConnection.send(JSON.stringify({
			type: type,
			body: payload,
		}));
	}

	/**
	 * チャンネルに接続
	 */
	public connectChannel(id: string, params: unknown, channel: ChannelServiceName, pong = false): void {
		const channelService = this.channelsService.getChannelService(channel);

		if (channelService.requireCredential && this.user == null) {
			return;
		}

		// 共有可能チャンネルに接続しようとしていて、かつそのチャンネルに既に接続していたら無意味なので無視
		if (channelService.shouldShare && this.channels.some(c => c.chName === channel)) {
			return;
		}

		const ch = channelService.create(id, this);
		this.channels.push(ch);
		ch.init(params ?? {});

		if (pong) {
			this.sendMessageToWs('connected', {
				id: id,
			});
		}
	}

	/**
	 * チャンネルから切断
	 * @param id チャンネルコネクションID
	 */
	public disconnectChannel(id: string): void {
		const channel = this.channels.find(c => c.id === id);

		if (channel) {
			if (channel.dispose) channel.dispose();
			this.channels = this.channels.filter(c => c.id !== id);
		}
	}

	/**
	 * チャンネルへメッセージ送信要求時
	 * @param data メッセージ
	 */
	private onChannelMessageRequested(data: { id: string; type: string; body?: unknown }): void {
		const channel = this.channels.find(c => c.id === data.id);
		if (channel != null && channel.onMessage != null) {
			channel.onMessage(data.type, data.body);
		}
	}

	/**
	 * ストリームが切れたとき
	 */
	public dispose(): void {
		if (this.fetchIntervalId !== null) {
			clearInterval(this.fetchIntervalId);
		}
		for (const c of this.channels) {
			c.dispose?.();
		}
	}
}
