import { Injectable } from '@nestjs/common';
import { bindThis } from '@/decorators.js';
import Channel from '../channel.js';

class DriveChannel extends Channel {
	public readonly chName = 'drive';
	public static override shouldShare = true;
	public static override requireCredential = true;

	@bindThis
	public async init(params: any): Promise<void> {
		// Subscribe drive stream
		this.subscriber.on(`driveStream:${this.user!.id}`, data => {
			this.send(data);
		});
	}
}

@Injectable()
export class DriveChannelService {
	public readonly shouldShare = DriveChannel.shouldShare;
	public readonly requireCredential = DriveChannel.requireCredential;

	constructor(
	) {
	}

	@bindThis
	public create(id: string, connection: Channel['connection']): DriveChannel {
		return new DriveChannel(
			id,
			connection,
		);
	}
}
