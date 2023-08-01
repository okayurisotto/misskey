import type { Channel } from '@/models/entities/Channel.js';
import type { User } from '@/models/entities/User.js';
import type { UserProfile } from '@/models/entities/UserProfile.js';
import type { Note } from '@/models/entities/Note.js';
import type { Antenna } from '@/models/entities/Antenna.js';
import type { DriveFile } from '@/models/entities/DriveFile.js';
import type { DriveFolder } from '@/models/entities/DriveFolder.js';
import type { UserList } from '@/models/entities/UserList.js';
import type { AbuseUserReport } from '@/models/entities/AbuseUserReport.js';
import type { Signin } from '@/models/entities/Signin.js';
import type { Page } from '@/models/entities/Page.js';
import type { Webhook } from '@/models/entities/Webhook.js';
import type { Meta } from '@/models/entities/Meta.js';
import { Role, RoleAssignment } from '@/models/index.js';
import type { EmojiDetailedSchema } from '@/models/zod/EmojiDetailedSchema.js';
import type { NotificationSchema } from '@/models/zod/NotificationSchema.js';
import type { NoteSchema } from '@/models/zod/NoteSchema.js';
import type { UserDetailedNotMeSchema } from '@/models/zod/UserDetailedNotMeSchema.js';
import type { UserSchema } from '@/models/zod/UserSchema.js';
import type { DriveFileSchema } from '@/models/zod/DriveFileSchema.js';
import type { DriveFolderSchema } from '@/models/zod/DriveFolderSchema.js';
import type { z } from 'zod';
import type { EventEmitter } from 'events';
import type Emitter from 'strict-event-emitter-types';

//#region Stream type-body definitions
export interface InternalStreamTypes {
	userChangeSuspendedState: { id: User['id']; isSuspended: User['isSuspended']; };
	userTokenRegenerated: { id: User['id']; oldToken: string; newToken: string; };
	remoteUserUpdated: { id: User['id']; };
	follow: { followerId: User['id']; followeeId: User['id']; };
	unfollow: { followerId: User['id']; followeeId: User['id']; };
	blockingCreated: { blockerId: User['id']; blockeeId: User['id']; };
	blockingDeleted: { blockerId: User['id']; blockeeId: User['id']; };
	policiesUpdated: Role['policies'];
	roleCreated: Role;
	roleDeleted: Role;
	roleUpdated: Role;
	userRoleAssigned: RoleAssignment;
	userRoleUnassigned: RoleAssignment;
	webhookCreated: Webhook;
	webhookDeleted: Webhook;
	webhookUpdated: Webhook;
	antennaCreated: Antenna;
	antennaDeleted: Antenna;
	antennaUpdated: Antenna;
	metaUpdated: Meta;
	followChannel: { userId: User['id']; channelId: Channel['id']; };
	unfollowChannel: { userId: User['id']; channelId: Channel['id']; };
	updateUserProfile: UserProfile;
	mute: { muterId: User['id']; muteeId: User['id']; };
	unmute: { muterId: User['id']; muteeId: User['id']; };
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
		pageId: Page['id'];
		event: string;
		var: any;
		userId: User['id'];
		user: z.infer<typeof UserSchema>;
	};
	urlUploadFinished: {
		marker?: string | null;
		file: z.infer<typeof DriveFileSchema>;
	};
	readAllNotifications: undefined;
	unreadNotification: z.infer<typeof NotificationSchema>;
	unreadMention: Note['id'];
	readAllUnreadMentions: undefined;
	unreadSpecifiedNote: Note['id'];
	readAllUnreadSpecifiedNotes: undefined;
	readAllAntennas: undefined;
	unreadAntenna: Antenna;
	readAllAnnouncements: undefined;
	myTokenRegenerated: undefined;
	signin: Signin;
	registryUpdated: {
		scope?: string[];
		key: string;
		value: any | null;
	};
	driveFileCreated: z.infer<typeof DriveFileSchema>;
	readAntenna: Antenna;
	receiveFollowRequest: z.infer<typeof UserSchema>;
}

export interface DriveStreamTypes {
	fileCreated: z.infer<typeof DriveFileSchema>;
	fileDeleted: DriveFile['id'];
	fileUpdated: z.infer<typeof DriveFileSchema>;
	folderCreated: z.infer<typeof DriveFolderSchema>;
	folderDeleted: DriveFolder['id'];
	folderUpdated: z.infer<typeof DriveFolderSchema>;
}

export interface NoteStreamTypes {
	pollVoted: {
		choice: number;
		userId: User['id'];
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
		userId: User['id'];
	};
	unreacted: {
		reaction: string;
		userId: User['id'];
	};
}
type NoteStreamEventTypes = {
	[key in keyof NoteStreamTypes]: {
		id: Note['id'];
		body: NoteStreamTypes[key];
	};
};

export interface UserListStreamTypes {
	userAdded: z.infer<typeof UserSchema>;
	userRemoved: z.infer<typeof UserSchema>;
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
		targetUserId: User['id'],
		reporterId: User['id'],
		comment: string;
	};
}
//#endregion

// 辞書(interface or type)から{ type, body }ユニオンを定義
// https://stackoverflow.com/questions/49311989/can-i-infer-the-type-of-a-value-using-extends-keyof-type
// VS Codeの展開を防止するためにEvents型を定義
type Events<T extends object> = { [K in keyof T]: { type: K; body: T[K]; } };
type EventUnionFromDictionary<
	T extends object,
	U = Events<T>
> = U[keyof U];

// redis通すとDateのインスタンスはstringに変換されるので
export type Serialized<T> = {
	[K in keyof T]:
		T[K] extends Date
			? string
			: T[K] extends (Date | null)
				? (string | null)
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
		name: `mainStream:${User['id']}`;
		payload: EventUnionFromDictionary<SerializedAll<MainStreamTypes>>;
	};
	drive: {
		name: `driveStream:${User['id']}`;
		payload: EventUnionFromDictionary<SerializedAll<DriveStreamTypes>>;
	};
	note: {
		name: `noteStream:${Note['id']}`;
		payload: EventUnionFromDictionary<SerializedAll<NoteStreamEventTypes>>;
	};
	userList: {
		name: `userListStream:${UserList['id']}`;
		payload: EventUnionFromDictionary<SerializedAll<UserListStreamTypes>>;
	};
	roleTimeline: {
		name: `roleTimelineStream:${Role['id']}`;
		payload: EventUnionFromDictionary<SerializedAll<RoleTimelineStreamTypes>>;
	};
	antenna: {
		name: `antennaStream:${Antenna['id']}`;
		payload: EventUnionFromDictionary<SerializedAll<AntennaStreamTypes>>;
	};
	admin: {
		name: `adminStream:${User['id']}`;
		payload: EventUnionFromDictionary<SerializedAll<AdminStreamTypes>>;
	};
	notes: {
		name: 'notesStream';
		payload: Serialized<z.infer<typeof NoteSchema>>;
	};
};

// API event definitions
// ストリームごとのEmitterの辞書を用意
type EventEmitterDictionary = { [x in keyof StreamMessages]: Emitter.default<EventEmitter, { [y in StreamMessages[x]['name']]: (e: StreamMessages[x]['payload']) => void }> };
// 共用体型を交差型にする型 https://stackoverflow.com/questions/54938141/typescript-convert-union-to-intersection
type UnionToIntersection<U> = (U extends any ? (k: U) => void : never) extends ((k: infer I) => void) ? I : never;
// Emitter辞書から共用体型を作り、UnionToIntersectionで交差型にする
export type StreamEventEmitter = UnionToIntersection<EventEmitterDictionary[keyof StreamMessages]>;
// { [y in name]: (e: spec) => void }をまとめてその交差型をEmitterにかけるとts(2590)にひっかかる

// provide stream channels union
export type StreamChannels = StreamMessages[keyof StreamMessages]['name'];
