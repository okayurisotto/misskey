import { Injectable } from '@nestjs/common';
import Channel from '../channel.js';

class AdminChannel extends Channel {
	public readonly chName = 'admin';
	public static override shouldShare = true;
	public static override requireCredential = true;

	public async init(params: any): Promise<void> {
		// Subscribe admin stream
		this.subscriber.on(`adminStream:${this.user!.id}`, data => {
			this.send(data.type, data.body);
		});
	}
}

@Injectable()
export class AdminChannelService {
	public readonly shouldShare = AdminChannel.shouldShare;
	public readonly requireCredential = AdminChannel.requireCredential;

	constructor(
	) {
	}

	public create(id: string, connection: Channel['connection']): AdminChannel {
		return new AdminChannel(
			id,
			connection,
		);
	}
}
