import { Injectable } from '@nestjs/common';
import { isUserRelated } from '@/misc/is-user-related.js';
import { NoteEntityService } from '@/core/entities/NoteEntityService.js';
import { RoleService } from '@/core/RoleService.js';
import { bindThis } from '@/decorators.js';
import Channel from '../channel.js';
import { StreamMessages } from '../types.js';

class RoleTimelineChannel extends Channel {
	public readonly chName = 'roleTimeline';
	public static override shouldShare = false;
	public static override requireCredential = false;
	private roleId: string;

	constructor(
		private readonly noteEntityService: NoteEntityService,
		private readonly roleservice: RoleService,

		id: string,
		connection: Channel['connection'],
	) {
		super(id, connection);
		//this.onNote = this.onNote.bind(this);
	}

	public async init(params: any): Promise<void> {
		this.roleId = params.roleId as string;

		// eslint-disable-next-line @typescript-eslint/unbound-method
		this.subscriber.on(`roleTimelineStream:${this.roleId}`, this.onEvent);
	}

	@bindThis
	private async onEvent(data: StreamMessages['roleTimeline']['payload']): Promise<void> {
		if (data.type === 'note') {
			const note = data.body;

			if (!(await this.roleservice.isExplorable({ id: this.roleId }))) {
				return;
			}
			if (note.visibility !== 'public') return;

			// 流れてきたNoteがミュートしているユーザーが関わるものだったら無視する
			if (isUserRelated(note, this.userIdsWhoMeMuting)) return;
			// 流れてきたNoteがブロックされているユーザーが関わるものだったら無視する
			if (isUserRelated(note, this.userIdsWhoBlockingMe)) return;

			if (note.renote && !note.text && isUserRelated(note, this.userIdsWhoMeMutingRenotes)) return;

			this.send('note', note);
		} else {
			this.send(data.type, data.body);
		}
	}

	public override dispose(): void {
		// Unsubscribe events
		// eslint-disable-next-line @typescript-eslint/unbound-method
		this.subscriber.off(`roleTimelineStream:${this.roleId}`, this.onEvent);
	}
}

@Injectable()
export class RoleTimelineChannelService {
	public readonly shouldShare = RoleTimelineChannel.shouldShare;
	public readonly requireCredential = RoleTimelineChannel.requireCredential;

	constructor(
		private readonly noteEntityService: NoteEntityService,
		private readonly roleservice: RoleService,
	) {
	}

	public create(id: string, connection: Channel['connection']): RoleTimelineChannel {
		return new RoleTimelineChannel(
			this.noteEntityService,
			this.roleservice,
			id,
			connection,
		);
	}
}
