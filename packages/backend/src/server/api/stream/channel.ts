import { bindThis } from '@/decorators.js';
import type Connection from './index.js';
import type { user, user_profile } from '@prisma/client';
import type { StreamEventEmitter } from './types.js';

/**
 * Stream channel
 */
export default abstract class Channel {
	protected connection: Connection;
	public id: string;
	public abstract readonly chName: string;
	public static readonly shouldShare: boolean;
	public static readonly requireCredential: boolean;

	protected get user(): user | undefined {
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

	@bindThis
	public send(typeOrPayload: any, payload?: any): void {
		const type = payload === undefined ? typeOrPayload.type : typeOrPayload;
		const body = payload === undefined ? typeOrPayload.body : payload;

		this.connection.sendMessageToWs('channel', {
			id: this.id,
			type: type,
			body: body,
		});
	}

	public abstract init(params: any): void;
	public dispose?(): void;
	public onMessage?(type: string, body: any): void;
}
