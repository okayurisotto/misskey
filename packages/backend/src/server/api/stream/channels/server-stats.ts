import Xev from 'xev';
import { Injectable } from '@nestjs/common';
import { bindThis } from '@/decorators.js';
import Channel from '../channel.js';

const ev = new Xev();

class ServerStatsChannel extends Channel {
	public readonly chName = 'serverStats';
	public static override shouldShare = true;
	public static override requireCredential = false;

	public async init(params: any): Promise<void> {
		// eslint-disable-next-line @typescript-eslint/unbound-method
		ev.addListener('serverStats', this.onStats);
	}

	@bindThis
	private onStats(stats: any): void {
		this.send('stats', stats);
	}

	public override onMessage(type: string, body: any): void {
		switch (type) {
			case 'requestLog':
				ev.once(`serverStatsLog:${body.id}`, statsLog => {
					this.send('statsLog', statsLog);
				});
				ev.emit('requestServerStatsLog', {
					id: body.id,
					length: body.length,
				});
				break;
		}
	}

	public override dispose(): void {
		// eslint-disable-next-line @typescript-eslint/unbound-method
		ev.removeListener('serverStats', this.onStats);
	}
}

@Injectable()
export class ServerStatsChannelService {
	public readonly shouldShare = ServerStatsChannel.shouldShare;
	public readonly requireCredential = ServerStatsChannel.requireCredential;

	public create(id: string, connection: Channel['connection']): ServerStatsChannel {
		return new ServerStatsChannel(
			id,
			connection,
		);
	}
}
