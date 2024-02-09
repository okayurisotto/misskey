import { Injectable } from '@nestjs/common';
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
import type { NoteSchema } from '@/models/zod/NoteSchema.js';
import { RedisPubService } from '@/core/RedisPubService.js';
import { ConfigLoaderService } from '@/ConfigLoaderService.js';
import type { z } from 'zod';
import type { role, Note, Antenna, user, user_list } from '@prisma/client';

@Injectable()
export class GlobalEventService {
	constructor(
		private readonly configLoaderService: ConfigLoaderService,
		private readonly redisForPub: RedisPubService,
	) {}

	private publish(
		channel: StreamChannels,
		type: string | null,
		value?: unknown,
	): void {
		const message =
			type == null
				? value
				: value == null
				? { type: type, body: null }
				: { type: type, body: value };

		this.redisForPub.publish(
			this.configLoaderService.data.host,
			JSON.stringify({
				channel: channel,
				message: message,
			}),
		);
	}

	public publishInternalEvent<K extends keyof InternalStreamTypes>(
		type: K,
		value?: InternalStreamTypes[K],
	): void {
		this.publish('internal', type, typeof value === 'undefined' ? null : value);
	}

	public publishBroadcastStream<K extends keyof BroadcastTypes>(
		type: K,
		value?: BroadcastTypes[K],
	): void {
		this.publish(
			'broadcast',
			type,
			typeof value === 'undefined' ? null : value,
		);
	}

	public publishMainStream<K extends keyof MainStreamTypes>(
		userId: user['id'],
		type: K,
		value?: MainStreamTypes[K],
	): void {
		this.publish(
			`mainStream:${userId}`,
			type,
			typeof value === 'undefined' ? null : value,
		);
	}

	public publishDriveStream<K extends keyof DriveStreamTypes>(
		userId: user['id'],
		type: K,
		value?: DriveStreamTypes[K],
	): void {
		this.publish(
			`driveStream:${userId}`,
			type,
			typeof value === 'undefined' ? null : value,
		);
	}

	public publishNoteStream<K extends keyof NoteStreamTypesBody>(
		noteId: Note['id'],
		type: K,
		value?: NoteStreamTypesBody[K],
	): void {
		this.publish(`noteStream:${noteId}`, type, {
			id: noteId,
			body: value,
		});
	}

	public publishUserListStream<K extends keyof UserListStreamTypes>(
		listId: user_list['id'],
		type: K,
		value?: UserListStreamTypes[K],
	): void {
		this.publish(
			`userListStream:${listId}`,
			type,
			typeof value === 'undefined' ? null : value,
		);
	}

	public publishAntennaStream<K extends keyof AntennaStreamTypes>(
		antennaId: Antenna['id'],
		type: K,
		value?: AntennaStreamTypes[K],
	): void {
		this.publish(
			`antennaStream:${antennaId}`,
			type,
			typeof value === 'undefined' ? null : value,
		);
	}

	public publishRoleTimelineStream<K extends keyof RoleTimelineStreamTypes>(
		roleId: role['id'],
		type: K,
		value?: RoleTimelineStreamTypes[K],
	): void {
		this.publish(
			`roleTimelineStream:${roleId}`,
			type,
			typeof value === 'undefined' ? null : value,
		);
	}

	public publishNotesStream(note: z.infer<typeof NoteSchema>): void {
		this.publish('notesStream', null, note);
	}

	public publishAdminStream<K extends keyof AdminStreamTypes>(
		userId: user['id'],
		type: K,
		value?: AdminStreamTypes[K],
	): void {
		this.publish(
			`adminStream:${userId}`,
			type,
			typeof value === 'undefined' ? null : value,
		);
	}
}
