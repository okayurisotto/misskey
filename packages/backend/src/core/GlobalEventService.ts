import { Inject, Injectable } from '@nestjs/common';
import * as Redis from 'ioredis';
import type {
	StreamChannels,
	AdminStreamTypes,
	AntennaStreamTypes,
	BroadcastTypes,
	DriveStreamTypes,
	InternalStreamTypes,
	MainStreamTypes,
	NoteStreamTypesBody,
	UserListStreamTypes,
	RoleTimelineStreamTypes,
} from '@/server/api/stream/types.js';
import { DI } from '@/di-symbols.js';
import type { Config } from '@/config.js';
import { bindThis } from '@/decorators.js';
import type { NoteSchema } from '@/models/zod/NoteSchema.js';
import type { z } from 'zod';
import type { role, note, antenna, user, user_list } from '@prisma/client';

@Injectable()
export class GlobalEventService {
	constructor(
		@Inject(DI.config)
		private readonly config: Config,

		@Inject(DI.redisForPub)
		private readonly redisForPub: Redis.Redis,
	) {}

	@bindThis
	private publish(channel: StreamChannels, type: string | null, value?: unknown): void {
		const message = type == null
			? value
			: value == null
				? { type: type, body: null }
				: { type: type, body: value };

		this.redisForPub.publish(this.config.host, JSON.stringify({
			channel: channel,
			message: message,
		}));
	}

	@bindThis
	public publishInternalEvent<K extends keyof InternalStreamTypes>(type: K, value?: InternalStreamTypes[K]): void {
		this.publish('internal', type, typeof value === 'undefined' ? null : value);
	}

	@bindThis
	public publishBroadcastStream<K extends keyof BroadcastTypes>(type: K, value?: BroadcastTypes[K]): void {
		this.publish('broadcast', type, typeof value === 'undefined' ? null : value);
	}

	@bindThis
	public publishMainStream<K extends keyof MainStreamTypes>(userId: user['id'], type: K, value?: MainStreamTypes[K]): void {
		this.publish(`mainStream:${userId}`, type, typeof value === 'undefined' ? null : value);
	}

	@bindThis
	public publishDriveStream<K extends keyof DriveStreamTypes>(userId: user['id'], type: K, value?: DriveStreamTypes[K]): void {
		this.publish(`driveStream:${userId}`, type, typeof value === 'undefined' ? null : value);
	}

	@bindThis
	public publishNoteStream<K extends keyof NoteStreamTypesBody>(noteId: note['id'], type: K, value?: NoteStreamTypesBody[K]): void {
		this.publish(`noteStream:${noteId}`, type, {
			id: noteId,
			body: value,
		});
	}

	@bindThis
	public publishUserListStream<K extends keyof UserListStreamTypes>(listId: user_list['id'], type: K, value?: UserListStreamTypes[K]): void {
		this.publish(`userListStream:${listId}`, type, typeof value === 'undefined' ? null : value);
	}

	@bindThis
	public publishAntennaStream<K extends keyof AntennaStreamTypes>(antennaId: antenna['id'], type: K, value?: AntennaStreamTypes[K]): void {
		this.publish(`antennaStream:${antennaId}`, type, typeof value === 'undefined' ? null : value);
	}

	@bindThis
	public publishRoleTimelineStream<K extends keyof RoleTimelineStreamTypes>(roleId: role['id'], type: K, value?: RoleTimelineStreamTypes[K]): void {
		this.publish(`roleTimelineStream:${roleId}`, type, typeof value === 'undefined' ? null : value);
	}

	@bindThis
	public publishNotesStream(note: z.infer<typeof NoteSchema>): void {
		this.publish('notesStream', null, note);
	}

	@bindThis
	public publishAdminStream<K extends keyof AdminStreamTypes>(userId: user['id'], type: K, value?: AdminStreamTypes[K]): void {
		this.publish(`adminStream:${userId}`, type, typeof value === 'undefined' ? null : value);
	}
}
