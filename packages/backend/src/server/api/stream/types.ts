import type { EmojiDetailedSchema } from '@/models/zod/EmojiDetailedSchema.js';
import type { NotificationSchema } from '@/models/zod/NotificationSchema.js';
import type { NoteSchema } from '@/models/zod/NoteSchema.js';
import type { UserDetailedNotMeSchema } from '@/models/zod/UserDetailedNotMeSchema.js';
import type { DriveFileSchema } from '@/models/zod/DriveFileSchema.js';
import type { DriveFolderSchema } from '@/models/zod/DriveFolderSchema.js';
import type { UserDetailedSchema } from '@/models/zod/UserDetailedSchema.js';
import type { MeDetailedSchema } from '@/models/zod/MeDetailedSchema.js';
import type { UserLiteSchema } from '@/models/zod/UserLiteSchema.js';
import type { Jsonify, UnionToIntersection } from 'type-fest';
import type { z } from 'zod';
import type { EventEmitter } from 'events';
import type Emitter from 'strict-event-emitter-types';
import type {
	AbuseUserReport,
	Antenna,
	DriveFile,
	DriveFolder,
	Note,
	page,
	role,
	signin,
	user_list,
	user,
	webhook,
} from '@prisma/client';

//#region Stream type-body definitions
export interface InternalStreamTypes {
	antennaCreated: Antenna;
	antennaDeleted: Antenna;
	antennaUpdated: Antenna;
	follow: { followerId: user['id']; followeeId: user['id'] };
	unfollow: { followerId: user['id']; followeeId: user['id'] };
	webhookCreated: webhook;
	webhookDeleted: webhook;
	webhookUpdated: webhook;
}

export interface BroadcastTypes {
	emojiAdded: { emoji: z.infer<typeof EmojiDetailedSchema> };
	emojiDeleted: { emojis: z.infer<typeof EmojiDetailedSchema>[] };
	emojiUpdated: { emojis: z.infer<typeof EmojiDetailedSchema>[] };
}

export interface MainStreamTypes {
	driveFileCreated: z.infer<typeof DriveFileSchema>;
	follow: z.infer<typeof UserDetailedNotMeSchema>;
	followed: z.infer<typeof UserLiteSchema>;
	mention: z.infer<typeof NoteSchema>;
	meUpdated: z.infer<typeof MeDetailedSchema>;
	myTokenRegenerated: undefined;
	notification: z.infer<typeof NotificationSchema>;
	pageEvent: {
		pageId: page['id'];
		event: string;
		var: unknown;
		userId: user['id'];
		user: z.infer<typeof UserDetailedSchema>;
	};
	readAllAnnouncements: undefined;
	readAllNotifications: undefined;
	readAllUnreadMentions: undefined;
	readAllUnreadSpecifiedNotes: undefined;
	receiveFollowRequest: z.infer<typeof UserLiteSchema>;
	registryUpdated: { scope: string[]; key: string; value: unknown };
	renote: z.infer<typeof NoteSchema>;
	reply: z.infer<typeof NoteSchema>;
	signin: signin;
	unfollow: z.infer<typeof UserDetailedNotMeSchema>;
	unreadMention: Note['id'];
	unreadNotification: z.infer<typeof NotificationSchema>;
	unreadSpecifiedNote: Note['id'];
	urlUploadFinished: {
		marker: string | null;
		file: z.infer<typeof DriveFileSchema>;
	};
}

export interface DriveStreamTypes {
	fileCreated: z.infer<typeof DriveFileSchema>;
	fileDeleted: DriveFile['id'];
	fileUpdated: z.infer<typeof DriveFileSchema>;
	folderCreated: z.infer<typeof DriveFolderSchema>;
	folderDeleted: DriveFolder['id'];
	folderUpdated: z.infer<typeof DriveFolderSchema>;
}

export interface NoteStreamTypesBody {
	deleted: { deletedAt: Date };
	pollVoted: { choice: number; userId: user['id'] };
	reacted: {
		reaction: string;
		emoji: { name: string; url: string } | null;
		userId: user['id'];
	};
	unreacted: { reaction: string; userId: user['id'] };
}
type NoteStreamTypes = {
	[key in keyof NoteStreamTypesBody]: {
		id: Note['id'];
		body: NoteStreamTypesBody[key];
	};
};

export interface UserListStreamTypes {
	userAdded: z.infer<typeof UserLiteSchema>;
	userRemoved: z.infer<typeof UserLiteSchema>;
}

export interface AntennaStreamTypes {
	note: Note;
}

export interface RoleTimelineStreamTypes {
	note: z.infer<typeof NoteSchema>;
}

export interface AdminStreamTypes {
	newAbuseUserReport: {
		id: AbuseUserReport['id'];
		targetUserId: user['id'];
		reporterId: user['id'];
		comment: string;
	};
}
//#endregion

// 辞書(interface or type)から{ type, body }ユニオンを定義
// https://stackoverflow.com/questions/49311989/can-i-infer-the-type-of-a-value-using-extends-keyof-type
// VS Codeの展開を防止するためにEvents型を定義
type Events<T extends object> = { [K in keyof T]: { type: K; body: T[K] } };
type EventUnionFromDictionary<T extends object, U = Events<T>> = U[keyof U];

// name/messages(spec) pairs dictionary
export type StreamMessages = {
	internal: {
		name: 'internal';
		payload: EventUnionFromDictionary<Jsonify<InternalStreamTypes>>;
	};
	broadcast: {
		name: 'broadcast';
		payload: EventUnionFromDictionary<Jsonify<BroadcastTypes>>;
	};
	main: {
		name: `mainStream:${user['id']}`;
		payload: EventUnionFromDictionary<Jsonify<MainStreamTypes>>;
	};
	drive: {
		name: `driveStream:${user['id']}`;
		payload: EventUnionFromDictionary<Jsonify<DriveStreamTypes>>;
	};
	note: {
		name: `noteStream:${Note['id']}`;
		payload: EventUnionFromDictionary<Jsonify<NoteStreamTypes>>;
	};
	userList: {
		name: `userListStream:${user_list['id']}`;
		payload: EventUnionFromDictionary<Jsonify<UserListStreamTypes>>;
	};
	roleTimeline: {
		name: `roleTimelineStream:${role['id']}`;
		payload: EventUnionFromDictionary<Jsonify<RoleTimelineStreamTypes>>;
	};
	antenna: {
		name: `antennaStream:${Antenna['id']}`;
		payload: EventUnionFromDictionary<Jsonify<AntennaStreamTypes>>;
	};
	admin: {
		name: `adminStream:${user['id']}`;
		payload: EventUnionFromDictionary<Jsonify<AdminStreamTypes>>;
	};
	notes: {
		name: 'notesStream';
		payload: Jsonify<z.infer<typeof NoteSchema>>;
	};
};

// API event definitions
// ストリームごとのEmitterの辞書を用意
type EventEmitterDictionary = {
	[x in keyof StreamMessages]: Emitter.default<
		EventEmitter,
		{
			[y in StreamMessages[x]['name']]: (
				e: StreamMessages[x]['payload'],
			) => void;
		}
	>;
};
export type StreamEventEmitter = UnionToIntersection<
	EventEmitterDictionary[keyof StreamMessages]
>;

export type StreamChannels = StreamMessages[keyof StreamMessages]['name'];
