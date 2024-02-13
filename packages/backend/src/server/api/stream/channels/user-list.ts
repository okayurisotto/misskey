import { Injectable } from '@nestjs/common';
import { isUserRelated } from '@/misc/is-user-related.js';
import { NoteEntityPackService } from '@/core/entities/NoteEntityPackService.js';
import type { NoteSchema } from '@/models/zod/NoteSchema.js';
import { PrismaService } from '@/core/PrismaService.js';
import { bindThis } from '@/decorators.js';
import Channel from '../channel.js';
import type { z } from 'zod';
import type { User } from '@prisma/client';

class UserListChannel extends Channel {
	public readonly chName = 'userList';
	public static override shouldShare = false;
	public static override requireCredential = false;
	private listId: string;
	public listUsers: User['id'][] = [];
	private listUsersClock: NodeJS.Timer;

	constructor(
		private readonly noteEntityService: NoteEntityPackService,
		private readonly prismaService: PrismaService,

		id: string,
		connection: Channel['connection'],
	) {
		super(id, connection);
		//this.updateListUsers = this.updateListUsers.bind(this);
		//this.onNote = this.onNote.bind(this);
	}

	public async init(params: any): Promise<void> {
		this.listId = params.listId as string;

		// Check existence and owner
		const listExist = (await this.prismaService.client.user_list.count({
			where: {
				id: this.listId,
				userId: this.user!.id,
			},
			take: 1
		})) > 0;
		if (!listExist) return;

		// Subscribe stream
		this.subscriber.on(`userListStream:${this.listId}`, ({ type, body }) => this.send(type, body));

		// eslint-disable-next-line @typescript-eslint/unbound-method
		this.subscriber.on('notesStream', this.onNote);

		this.updateListUsers();
		// eslint-disable-next-line @typescript-eslint/unbound-method
		this.listUsersClock = setInterval(this.updateListUsers, 5000);
	}

	@bindThis
	private async updateListUsers(): Promise<void> {
		const users = await this.prismaService.client.user_list_joining.findMany({
			where: {
				userListId: this.listId,
			},
		});

		this.listUsers = users.map(x => x.userId);
	}

	@bindThis
	private async onNote(note: z.infer<typeof NoteSchema>): Promise<void> {
		if (!this.listUsers.includes(note.userId)) return;

		if (['followers', 'specified'].includes(note.visibility)) {
			note = await this.noteEntityService.pack(note.id, this.user, {
				detail: true,
			});

			if (note.isHidden) {
				return;
			}
		} else {
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
		}

		// 流れてきたNoteがミュートしているユーザーが関わるものだったら無視する
		if (isUserRelated(note, this.userIdsWhoMeMuting)) return;
		// 流れてきたNoteがブロックされているユーザーが関わるものだったら無視する
		if (isUserRelated(note, this.userIdsWhoBlockingMe)) return;

		if (note.renote && !note.text && isUserRelated(note, this.userIdsWhoMeMutingRenotes)) return;

		this.send('note', note);
	}

	public override dispose(): void {
		// Unsubscribe events
		this.subscriber.off(`userListStream:${this.listId}`, () => {});
		// eslint-disable-next-line @typescript-eslint/unbound-method
		this.subscriber.off('notesStream', this.onNote);

		clearInterval(this.listUsersClock);
	}
}

@Injectable()
export class UserListChannelService {
	public readonly shouldShare = UserListChannel.shouldShare;
	public readonly requireCredential = UserListChannel.requireCredential;

	constructor(
		private readonly noteEntityService: NoteEntityPackService,
		private readonly prismaService: PrismaService,
	) {
	}

	public create(id: string, connection: Channel['connection']): UserListChannel {
		return new UserListChannel(
			this.noteEntityService,
			this.prismaService,
			id,
			connection,
		);
	}
}
