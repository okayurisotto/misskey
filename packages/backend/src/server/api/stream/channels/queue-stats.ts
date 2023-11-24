import Xev from 'xev';
import { Injectable } from '@nestjs/common';
import { bindThis } from '@/decorators.js';
import Channel from '../channel.js';

const ev = new Xev();

class QueueStatsChannel extends Channel {
	public readonly chName = 'queueStats';
	public static override shouldShare = true;
	public static override requireCredential = false;

	public async init(params: any): Promise<void> {
		// eslint-disable-next-line @typescript-eslint/unbound-method
		ev.addListener('queueStats', this.onStats);
	}

	@bindThis
	private onStats(stats: any): void {
		this.send('stats', stats);
	}

	public override onMessage(type: string, body: any): void {
		switch (type) {
			case 'requestLog':
				ev.once(`queueStatsLog:${body.id}`, statsLog => {
					this.send('statsLog', statsLog);
				});
				ev.emit('requestQueueStatsLog', {
					id: body.id,
					length: body.length,
				});
				break;
		}
	}

	public override dispose(): void {
		// eslint-disable-next-line @typescript-eslint/unbound-method
		ev.removeListener('queueStats', this.onStats);
	}
}

@Injectable()
export class QueueStatsChannelService {
	public readonly shouldShare = QueueStatsChannel.shouldShare;
	public readonly requireCredential = QueueStatsChannel.requireCredential;

	public create(id: string, connection: Channel['connection']): QueueStatsChannel {
		return new QueueStatsChannel(
			id,
			connection,
		);
	}
}
