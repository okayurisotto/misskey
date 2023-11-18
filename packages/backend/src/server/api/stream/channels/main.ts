import { Injectable } from '@nestjs/common';
import { z } from 'zod';
import { isInstanceMuted, isUserFromMutedInstance } from '@/misc/is-instance-muted.js';
import { NoteEntityPackService } from '@/core/entities/NoteEntityPackService.js';
import Channel from '../channel.js';

class MainChannel extends Channel {
	public readonly chName = 'main';
	public static override shouldShare = true;
	public static override requireCredential = true;

	constructor(
		private readonly noteEntityService: NoteEntityPackService,

		id: string,
		connection: Channel['connection'],
	) {
		super(id, connection);
	}

	public async init(params: any): Promise<void> {
		// Subscribe main stream channel
		this.subscriber.on(`mainStream:${this.user!.id}`, async data => {
			switch (data.type) {
				case 'notification': {
					// Ignore notifications from instances the user has muted
					if (isUserFromMutedInstance(data.body, new Set<string>(z.array(z.string()).optional().parse(this.userProfile?.mutedInstances) ?? []))) return;
					if (data.body.userId && this.userIdsWhoMeMuting.has(data.body.userId)) return;

					if (data.body.note && data.body.note.isHidden) {
						const note = await this.noteEntityService.pack(data.body.note.id, this.user, {
							detail: true,
						});
						this.connection.cacheNote(note);
						data.body.note = note;
					}
					break;
				}
				case 'mention': {
					if (isInstanceMuted(data.body, new Set<string>(z.array(z.string()).optional().parse(this.userProfile?.mutedInstances) ?? []))) return;

					if (this.userIdsWhoMeMuting.has(data.body.userId)) return;
					if (data.body.isHidden) {
						const note = await this.noteEntityService.pack(data.body.id, this.user, {
							detail: true,
						});
						this.connection.cacheNote(note);
						data.body = note;
					}
					break;
				}
			}

			this.send(data.type, data.body);
		});
	}
}

@Injectable()
export class MainChannelService {
	public readonly shouldShare = MainChannel.shouldShare;
	public readonly requireCredential = MainChannel.requireCredential;

	constructor(
		private readonly noteEntityService: NoteEntityPackService,
	) {
	}

	public create(id: string, connection: Channel['connection']): MainChannel {
		return new MainChannel(
			this.noteEntityService,
			id,
			connection,
		);
	}
}
