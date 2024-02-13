import type Connection from './index.js';
import type { User, user_profile } from '@prisma/client';
import type { StreamEventEmitter } from './types.js';

/**
 * Stream channel
 */
// eslint-disable-next-line import/no-default-export
export default abstract class Channel {
	protected readonly connection: Connection;
	public abstract readonly chName: string;
	public readonly id;
	public static readonly requireCredential: boolean;
	public static readonly shouldShare: boolean;

	protected get user(): User | undefined {
		return this.connection.user;
	}

	protected get userProfile(): user_profile | null {
		return this.connection.userProfile;
	}

	protected get following(): Set<string> {
		return this.connection.following;
	}

	protected get userIdsWhoMeMuting(): Set<string> {
		return this.connection.userIdsWhoMeMuting;
	}

	protected get userIdsWhoMeMutingRenotes(): Set<string> {
		return this.connection.userIdsWhoMeMutingRenotes;
	}

	protected get userIdsWhoBlockingMe(): Set<string> {
		return this.connection.userIdsWhoBlockingMe;
	}

	protected get followingChannels(): Set<string> {
		return this.connection.followingChannels;
	}

	protected get subscriber(): StreamEventEmitter {
		return this.connection.subscriber;
	}

	constructor(id: string, connection: Connection) {
		this.id = id;
		this.connection = connection;
	}

	public send(typeOrPayload: string, payload: unknown): void {
		this.connection.sendMessageToWs('channel', {
			id: this.id,
			type: typeOrPayload,
			body: payload,
		});
	}

	public abstract init(params: unknown): void;
	public dispose?(): void;
	public onMessage?(type: string, body: unknown): void;
}
