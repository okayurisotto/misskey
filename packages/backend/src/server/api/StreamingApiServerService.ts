import { EventEmitter } from 'events';
import { Injectable } from '@nestjs/common';
import * as WebSocket from 'ws';
import { NoteReadService } from '@/core/NoteReadService.js';
import { NotificationService } from '@/core/NotificationService.js';
import { LocalUser } from '@/models/entities/User.js';
import { PrismaService } from '@/core/PrismaService.js';
import { RedisSubService } from '@/core/RedisSubService.js';
import { AuthenticateService, AuthenticationError } from './AuthenticateService.js';
import MainStreamConnection from './stream/index.js';
import { ChannelsService } from './stream/ChannelsService.js';
import type * as http from 'node:http';
import type { access_token } from '@prisma/client';

@Injectable()
export class StreamingApiServerService {
	#wss: WebSocket.WebSocketServer;
	readonly #connections = new Map<WebSocket.WebSocket, number>();
	#cleanConnectionsIntervalId: NodeJS.Timeout | null = null;

	constructor(
		private readonly noteReadService: NoteReadService,
		private readonly authenticateService: AuthenticateService,
		private readonly channelsService: ChannelsService,
		private readonly notificationService: NotificationService,
		private readonly prismaService: PrismaService,
		private readonly redisForSub: RedisSubService,
	) {}

	public attach(server: http.Server): void {
		this.#wss = new WebSocket.WebSocketServer({
			noServer: true,
		});

		server.on('upgrade', async (request, socket, head) => {
			if (request.url == null) {
				socket.write('HTTP/1.1 400 Bad Request\r\n\r\n');
				socket.destroy();
				return;
			}

			const q = new URL(request.url, `http://${request.headers.host}`).searchParams;

			let user: LocalUser | null = null;
			let app: access_token | null = null;

			// https://datatracker.ietf.org/doc/html/rfc6750.html#section-2.1
			// Note that the standard WHATWG WebSocket API does not support setting any headers,
			// but non-browser apps may still be able to set it.
			const token = request.headers.authorization?.startsWith('Bearer ')
				? request.headers.authorization.slice(7)
				: q.get('i');

			try {
				[user, app] = await this.authenticateService.authenticate(token);
			} catch (e) {
				if (e instanceof AuthenticationError) {
					socket.write([
						'HTTP/1.1 401 Unauthorized',
						'WWW-Authenticate: Bearer realm="Misskey", error="invalid_token", error_description="Failed to authenticate"',
					].join('\r\n') + '\r\n\r\n');
				} else {
					socket.write('HTTP/1.1 500 Internal Server Error\r\n\r\n');
				}
				socket.destroy();
				return;
			}

			if (user?.isSuspended) {
				socket.write('HTTP/1.1 403 Forbidden\r\n\r\n');
				socket.destroy();
				return;
			}

			const stream = new MainStreamConnection(
				this.channelsService,
				this.noteReadService,
				this.notificationService,
				this.prismaService,
				user, app,
			);

			await stream.init();

			this.#wss.handleUpgrade(request, socket, head, (ws) => {
				this.#wss.emit('connection', ws, request, {
					stream, user, app,
				});
			});
		});

		const globalEv = new EventEmitter();

		this.redisForSub.on('message', (_: string, data: string) => {
			const parsed = JSON.parse(data);
			globalEv.emit('message', parsed);
		});

		this.#wss.on('connection', (connection: WebSocket.WebSocket, request: http.IncomingMessage, ctx: {
			stream: MainStreamConnection,
			user: LocalUser | null;
			app: access_token | null
		}) => {
			const { stream, user, app } = ctx;

			const ev = new EventEmitter();

			function onRedisMessage(data: any): void {
				ev.emit(data.channel, data.message);
			}

			globalEv.on('message', onRedisMessage);

			stream.listen(ev, connection);

			this.#connections.set(connection, Date.now());

			const userUpdateIntervalId = user ? setInterval(() => {
				this.prismaService.client.user.update({
					where: { id: user.id },
					data: { lastActiveDate: new Date() },
				});
			}, 1000 * 60 * 5) : null;
			if (user) {
				this.prismaService.client.user.update({
					where: { id: user.id },
					data: { lastActiveDate: new Date() },
				});
			}

			connection.once('close', () => {
				ev.removeAllListeners();
				stream.dispose();
				globalEv.off('message', onRedisMessage);
				this.#connections.delete(connection);
				if (userUpdateIntervalId) clearInterval(userUpdateIntervalId);
			});

			connection.on('pong', () => {
				this.#connections.set(connection, Date.now());
			});
		});

		// 一定期間通信が無いコネクションは実際には切断されている可能性があるため定期的にterminateする
		this.#cleanConnectionsIntervalId = setInterval(() => {
			const now = Date.now();
			for (const [connection, lastActive] of this.#connections.entries()) {
				if (now - lastActive > 1000 * 60 * 2) {
					connection.terminate();
					this.#connections.delete(connection);
				} else {
					connection.ping();
				}
			}
		}, 1000 * 60);
	}

	public detach(): Promise<void> {
		if (this.#cleanConnectionsIntervalId) {
			clearInterval(this.#cleanConnectionsIntervalId);
			this.#cleanConnectionsIntervalId = null;
		}
		return new Promise((resolve) => {
			this.#wss.close(() => resolve());
		});
	}
}
