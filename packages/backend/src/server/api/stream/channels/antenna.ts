import { Injectable } from '@nestjs/common';
import { isUserRelated } from '@/misc/is-user-related.js';
import { NoteEntityPackService } from '@/core/entities/NoteEntityPackService.js';
import { bindThis } from '@/decorators.js';
import Channel from '../channel.js';
import type { StreamMessages } from '../types.js';

class AntennaChannel extends Channel {
	public readonly chName = 'antenna';
	public static override shouldShare = false;
	public static override requireCredential = false;
	private antennaId: string;

	constructor(
		private readonly noteEntityService: NoteEntityPackService,

		id: string,
		connection: Channel['connection'],
	) {
		super(id, connection);
		//this.onEvent = this.onEvent.bind(this);
	}

	public async init(params: any): Promise<void> {
		this.antennaId = params.antennaId as string;

		// Subscribe stream
		// eslint-disable-next-line @typescript-eslint/unbound-method
		this.subscriber.on(`antennaStream:${this.antennaId}`, this.onEvent);
	}

	@bindThis
	private async onEvent(data: StreamMessages['antenna']['payload']): Promise<void> {
		if (data.type === 'note') {
			const note = await this.noteEntityService.pack(data.body.id, this.user, { detail: true });

			// 流れてきたNoteがミュートしているユーザーが関わるものだったら無視する
			if (isUserRelated(note, this.userIdsWhoMeMuting)) return;
			// 流れてきたNoteがブロックされているユーザーが関わるものだったら無視する
			if (isUserRelated(note, this.userIdsWhoBlockingMe)) return;

			if (note.renote && !note.text && isUserRelated(note, this.userIdsWhoMeMutingRenotes)) return;

			this.connection.cacheNote(note);

			this.send('note', note);
		} else {
			this.send(data.type, data.body);
		}
	}

	public override dispose(): void {
		// Unsubscribe events
		// eslint-disable-next-line @typescript-eslint/unbound-method
		this.subscriber.off(`antennaStream:${this.antennaId}`, this.onEvent);
	}
}

@Injectable()
export class AntennaChannelService {
	public readonly shouldShare = AntennaChannel.shouldShare;
	public readonly requireCredential = AntennaChannel.requireCredential;

	constructor(
		private readonly noteEntityService: NoteEntityPackService,
	) {
	}

	public create(id: string, connection: Channel['connection']): AntennaChannel {
		return new AntennaChannel(
			this.noteEntityService,
			id,
			connection,
		);
	}
}
