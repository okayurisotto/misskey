import { Injectable } from '@nestjs/common';
import { isUserRelated } from '@/misc/is-user-related.js';
import { NoteEntityService } from '@/core/entities/NoteEntityService.js';
import { bindThis } from '@/decorators.js';
import type { NoteSchema } from '@/models/zod/NoteSchema.js';
import Channel from '../channel.js';
import type { z } from 'zod';

class ChannelChannel extends Channel {
	public readonly chName = 'channel';
	public static override shouldShare = false;
	public static override requireCredential = false;
	private channelId: string;

	constructor(
		private readonly noteEntityService: NoteEntityService,

		id: string,
		connection: Channel['connection'],
	) {
		super(id, connection);
		//this.onNote = this.onNote.bind(this);
	}

	@bindThis
	public async init(params: any): Promise<void> {
		this.channelId = params.channelId as string;

		// Subscribe stream
		this.subscriber.on('notesStream', this.onNote);
	}

	@bindThis
	private async onNote(note: z.infer<typeof NoteSchema>): Promise<void> {
		if (note.channelId !== this.channelId) return;

		// リプライなら再pack
		if (note.replyId != null) {
			note.reply = await this.noteEntityService.pack(note.replyId, this.user, {
				detail: true,
			});
		}
		// Renoteなら再pack
		if (note.renoteId != null) {
			note.renote = await this.noteEntityService.pack(note.renoteId, this.user, {
				detail: true,
			});
		}

		// 流れてきたNoteがミュートしているユーザーが関わるものだったら無視する
		if (isUserRelated(note, this.userIdsWhoMeMuting)) return;
		// 流れてきたNoteがブロックされているユーザーが関わるものだったら無視する
		if (isUserRelated(note, this.userIdsWhoBlockingMe)) return;

		if (note.renote && !note.text && isUserRelated(note, this.userIdsWhoMeMutingRenotes)) return;

		this.connection.cacheNote(note);

		this.send('note', note);
	}

	@bindThis
	public override dispose(): void {
		// Unsubscribe events
		this.subscriber.off('notesStream', this.onNote);
	}
}

@Injectable()
export class ChannelChannelService {
	public readonly shouldShare = ChannelChannel.shouldShare;
	public readonly requireCredential = ChannelChannel.requireCredential;

	constructor(
		private readonly noteEntityService: NoteEntityService,
	) {
	}

	@bindThis
	public create(id: string, connection: Channel['connection']): ChannelChannel {
		return new ChannelChannel(
			this.noteEntityService,
			id,
			connection,
		);
	}
}
