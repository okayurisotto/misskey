import { Injectable } from '@nestjs/common';
import { z } from 'zod';
import { checkWordMute } from '@/misc/check-word-mute.js';
import { isInstanceMuted } from '@/misc/is-instance-muted.js';
import { isUserRelated } from '@/misc/is-user-related.js';
import { MetaService } from '@/core/MetaService.js';
import { NoteEntityService } from '@/core/entities/NoteEntityService.js';
import { RoleService } from '@/core/RoleService.js';
import type { NoteSchema } from '@/models/zod/NoteSchema.js';
import { bindThis } from '@/decorators.js';
import Channel from '../channel.js';

class GlobalTimelineChannel extends Channel {
	public readonly chName = 'globalTimeline';
	public static override shouldShare = true;
	public static override requireCredential = false;
	private withReplies: boolean;

	constructor(
		private readonly metaService: MetaService,
		private readonly roleService: RoleService,
		private readonly noteEntityService: NoteEntityService,

		id: string,
		connection: Channel['connection'],
	) {
		super(id, connection);
		//this.onNote = this.onNote.bind(this);
	}

	public async init(params: any): Promise<void> {
		const policies = await this.roleService.getUserPolicies(this.user ? this.user.id : null);
		if (!policies.gtlAvailable) return;

		this.withReplies = params.withReplies as boolean;

		// Subscribe events
		// eslint-disable-next-line @typescript-eslint/unbound-method
		this.subscriber.on('notesStream', this.onNote);
	}

	@bindThis
	private async onNote(note: z.infer<typeof NoteSchema>): Promise<void> {
		if (note.visibility !== 'public') return;
		if (note.channelId != null) return;

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

		// 関係ない返信は除外
		if (note.reply && !this.withReplies) {
			const reply = note.reply;
			// 「チャンネル接続主への返信」でもなければ、「チャンネル接続主が行った返信」でもなければ、「投稿者の投稿者自身への返信」でもない場合
			if (reply.userId !== this.user!.id && note.userId !== this.user!.id && reply.userId !== note.userId) return;
		}

		// Ignore notes from instances the user has muted
		if (isInstanceMuted(note, new Set<string>(z.array(z.string()).optional().parse(this.userProfile?.mutedInstances) ?? []))) return;

		// 流れてきたNoteがミュートしているユーザーが関わるものだったら無視する
		if (isUserRelated(note, this.userIdsWhoMeMuting)) return;
		// 流れてきたNoteがブロックされているユーザーが関わるものだったら無視する
		if (isUserRelated(note, this.userIdsWhoBlockingMe)) return;

		if (note.renote && !note.text && isUserRelated(note, this.userIdsWhoMeMutingRenotes)) return;

		// 流れてきたNoteがミュートすべきNoteだったら無視する
		// TODO: 将来的には、単にMutedNoteテーブルにレコードがあるかどうかで判定したい(以下の理由により難しそうではある)
		// 現状では、ワードミュートにおけるMutedNoteレコードの追加処理はストリーミングに流す処理と並列で行われるため、
		// レコードが追加されるNoteでも追加されるより先にここのストリーミングの処理に到達することが起こる。
		// そのためレコードが存在するかのチェックでは不十分なので、改めてcheckWordMuteを呼んでいる
		if (this.userProfile && checkWordMute(note, this.user, z.array(z.array(z.string())).parse(this.userProfile.mutedWords))) return;

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
export class GlobalTimelineChannelService {
	public readonly shouldShare = GlobalTimelineChannel.shouldShare;
	public readonly requireCredential = GlobalTimelineChannel.requireCredential;

	constructor(
		private readonly metaService: MetaService,
		private readonly roleService: RoleService,
		private readonly noteEntityService: NoteEntityService,
	) {
	}

	public create(id: string, connection: Channel['connection']): GlobalTimelineChannel {
		return new GlobalTimelineChannel(
			this.metaService,
			this.roleService,
			this.noteEntityService,
			id,
			connection,
		);
	}
}
