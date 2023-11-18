import { Injectable } from '@nestjs/common';
import { z } from 'zod';
import { normalizeForSearch } from '@/misc/normalize-for-search.js';
import { isUserRelated } from '@/misc/is-user-related.js';
import { NoteEntityPackService } from '@/core/entities/NoteEntityPackService.js';
import type { NoteSchema } from '@/models/zod/NoteSchema.js';
import { bindThis } from '@/decorators.js';
import Channel from '../channel.js';

class HashtagChannel extends Channel {
	public readonly chName = 'hashtag';
	public static override shouldShare = false;
	public static override requireCredential = false;
	private q: string[][];

	constructor(
		private readonly noteEntityService: NoteEntityPackService,

		id: string,
		connection: Channel['connection'],
	) {
		super(id, connection);
		//this.onNote = this.onNote.bind(this);
	}

	public async init(params: any): Promise<void> {
		this.q = params.q;

		if (this.q == null) return;

		// Subscribe stream
		// eslint-disable-next-line @typescript-eslint/unbound-method
		this.subscriber.on('notesStream', this.onNote);
	}

	@bindThis
	private async onNote(note: z.infer<typeof NoteSchema>): Promise<void> {
		const noteTags = note.tags ? note.tags.map((t: string) => t.toLowerCase()) : [];
		const matched = this.q.some(tags => tags.every(tag => noteTags.includes(normalizeForSearch(tag))));
		if (!matched) return;

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

	public override dispose(): void {
		// Unsubscribe events
		// eslint-disable-next-line @typescript-eslint/unbound-method
		this.subscriber.off('notesStream', this.onNote);
	}
}

@Injectable()
export class HashtagChannelService {
	public readonly shouldShare = HashtagChannel.shouldShare;
	public readonly requireCredential = HashtagChannel.requireCredential;

	constructor(
		private readonly noteEntityService: NoteEntityPackService,
	) {
	}

	public create(id: string, connection: Channel['connection']): HashtagChannel {
		return new HashtagChannel(
			this.noteEntityService,
			id,
			connection,
		);
	}
}
