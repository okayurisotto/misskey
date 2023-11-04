import type { EmojiDetailedSchema } from '@/models/zod/EmojiDetailedSchema.js';
import type { NotificationSchema } from '@/models/zod/NotificationSchema.js';
import type { NoteSchema } from '@/models/zod/NoteSchema.js';
import type { UserDetailedNotMeSchema } from '@/models/zod/UserDetailedNotMeSchema.js';
import type { UserSchema } from '@/models/zod/UserSchema.js';
import type { DriveFileSchema } from '@/models/zod/DriveFileSchema.js';
import type { DriveFolderSchema } from '@/models/zod/DriveFolderSchema.js';
import type { RolePoliciesSchema } from '@/models/zod/RolePoliciesSchema.js';
import type { UnionToIntersection } from 'type-fest';
import type { z } from 'zod';
import type { EventEmitter } from 'events';
import type Emitter from 'strict-event-emitter-types';
import type {
	AbuseUserReport,
	antenna,
	channel,
	drive_file,
	drive_folder,
	meta,
	note,
	page,
	role_assignment,
	role,
	signin,
	user_list,
	user_profile,
	user,
	webhook,
} from '@prisma/client';

//#region Stream type-body definitions
export interface InternalStreamTypes {
	userChangeSuspendedState: {
		id: user['id'];
		isSuspended: user['isSuspended'];
	};
	userTokenRegenerated: { id: user['id']; oldToken: string; newToken: string };
	remoteUserUpdated: { id: user['id'] };
	follow: { followerId: user['id']; followeeId: user['id'] };
	unfollow: { followerId: user['id']; followeeId: user['id'] };
	blockingCreated: { blockerId: user['id']; blockeeId: user['id'] };
	blockingDeleted: { blockerId: user['id']; blockeeId: user['id'] };
	policiesUpdated: z.infer<typeof RolePoliciesSchema>;
	roleCreated: role;
	roleDeleted: role;
	roleUpdated: role;
	userRoleAssigned: role_assignment;
	userRoleUnassigned: role_assignment;
	webhookCreated: webhook;
	webhookDeleted: webhook;
	webhookUpdated: webhook;
	antennaCreated: antenna;
	antennaDeleted: antenna;
	antennaUpdated: antenna;
	metaUpdated: meta;
	followChannel: { userId: user['id']; channelId: channel['id'] };
	unfollowChannel: { userId: user['id']; channelId: channel['id'] };
	updateUserProfile: user_profile;
	mute: { muterId: user['id']; muteeId: user['id'] };
	unmute: { muterId: user['id']; muteeId: user['id'] };
}

export interface BroadcastTypes {
	emojiAdded: {
		emoji: z.infer<typeof EmojiDetailedSchema>;
	};
	emojiUpdated: {
		emojis: z.infer<typeof EmojiDetailedSchema>[];
	};
	emojiDeleted: {
		emojis: {
			id?: string;
			name: string;
			[other: string]: any;
		}[];
	};
}

export interface MainStreamTypes {
	notification: z.infer<typeof NotificationSchema>;
	mention: z.infer<typeof NoteSchema>;
	reply: z.infer<typeof NoteSchema>;
	renote: z.infer<typeof NoteSchema>;
	follow: z.infer<typeof UserDetailedNotMeSchema>;
	followed: z.infer<typeof UserSchema>;
	unfollow: z.infer<typeof UserSchema>;
	meUpdated: z.infer<typeof UserSchema>;
	pageEvent: {
		pageId: page['id'];
		event: string;
		var: any;
		userId: user['id'];
		user: z.infer<typeof UserSchema>;
	};
	urlUploadFinished: {
		marker?: string | null;
		file: z.infer<typeof DriveFileSchema>;
	};
	readAllNotifications: undefined;
	unreadNotification: z.infer<typeof NotificationSchema>;
	unreadMention: note['id'];
	readAllUnreadMentions: undefined;
	unreadSpecifiedNote: note['id'];
	readAllUnreadSpecifiedNotes: undefined;
	readAllAntennas: undefined;
	unreadAntenna: antenna;
	readAllAnnouncements: undefined;
	myTokenRegenerated: undefined;
	signin: signin;
	registryUpdated: {
		scope?: string[];
		key: string;
		value: any | null;
	};
	driveFileCreated: z.infer<typeof DriveFileSchema>;
	readAntenna: antenna;
	receiveFollowRequest: z.infer<typeof UserSchema>;
}

export interface DriveStreamTypes {
	fileCreated: z.infer<typeof DriveFileSchema>;
	fileDeleted: drive_file['id'];
	fileUpdated: z.infer<typeof DriveFileSchema>;
	folderCreated: z.infer<typeof DriveFolderSchema>;
	folderDeleted: drive_folder['id'];
	folderUpdated: z.infer<typeof DriveFolderSchema>;
}

export interface NoteStreamTypes {
	pollVoted: {
		choice: number;
		userId: user['id'];
	};
	deleted: {
		deletedAt: Date;
	};
	reacted: {
		reaction: string;
		emoji?: {
			name: string;
			url: string;
		} | null;
		userId: user['id'];
	};
	unreacted: {
		reaction: string;
		userId: user['id'];
	};
}
type NoteStreamEventTypes = {
	[key in keyof NoteStreamTypes]: {
		id: note['id'];
		body: NoteStreamTypes[key];
	};
};

export interface UserListStreamTypes {
	userAdded: z.infer<typeof UserSchema>;
	userRemoved: z.infer<typeof UserSchema>;
}

export interface AntennaStreamTypes {
	note: note;
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

// redis通すとDateのインスタンスはstringに変換されるので
export type Serialized<T> = {
	[K in keyof T]: T[K] extends Date
		? string
		: T[K] extends Date | null
		? string | null
		: T[K] extends Record<string, any>
		? Serialized<T[K]>
		: T[K];
};

type SerializedAll<T> = {
	[K in keyof T]: Serialized<T[K]>;
};

// name/messages(spec) pairs dictionary
export type StreamMessages = {
	internal: {
		name: 'internal';
		payload: EventUnionFromDictionary<SerializedAll<InternalStreamTypes>>;
	};
	broadcast: {
		name: 'broadcast';
		payload: EventUnionFromDictionary<SerializedAll<BroadcastTypes>>;
	};
	main: {
		name: `mainStream:${user['id']}`;
		payload: EventUnionFromDictionary<SerializedAll<MainStreamTypes>>;
	};
	drive: {
		name: `driveStream:${user['id']}`;
		payload: EventUnionFromDictionary<SerializedAll<DriveStreamTypes>>;
	};
	note: {
		name: `noteStream:${note['id']}`;
		payload: EventUnionFromDictionary<SerializedAll<NoteStreamEventTypes>>;
	};
	userList: {
		name: `userListStream:${user_list['id']}`;
		payload: EventUnionFromDictionary<SerializedAll<UserListStreamTypes>>;
	};
	roleTimeline: {
		name: `roleTimelineStream:${role['id']}`;
		payload: EventUnionFromDictionary<SerializedAll<RoleTimelineStreamTypes>>;
	};
	antenna: {
		name: `antennaStream:${antenna['id']}`;
		payload: EventUnionFromDictionary<SerializedAll<AntennaStreamTypes>>;
	};
	admin: {
		name: `adminStream:${user['id']}`;
		payload: EventUnionFromDictionary<SerializedAll<AdminStreamTypes>>;
	};
	notes: {
		name: 'notesStream';
		payload: Serialized<z.infer<typeof NoteSchema>>;
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
// Emitter辞書から共用体型を作り、UnionToIntersectionで交差型にする
export type StreamEventEmitter = UnionToIntersection<
	EventEmitterDictionary[keyof StreamMessages]
>;
// { [y in name]: (e: spec) => void }をまとめてその交差型をEmitterにかけるとts(2590)にひっかかる

// provide stream channels union
export type StreamChannels = StreamMessages[keyof StreamMessages]['name'];
