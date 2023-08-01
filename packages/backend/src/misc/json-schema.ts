import {
	packedUserLiteSchema,
	packedUserDetailedNotMeOnlySchema,
	packedMeDetailedOnlySchema,
	packedUserDetailedNotMeSchema,
	packedMeDetailedSchema,
	packedUserDetailedSchema,
	packedUserSchema,
} from '@/models/json-schema/user.js';
import { packedNoteSchema } from '@/models/json-schema/note.js';
import { packedUserListSchema } from '@/models/json-schema/user-list.js';
import { packedAppSchema } from '@/models/json-schema/app.js';
import { packedNotificationSchema } from '@/models/json-schema/notification.js';
import { packedDriveFileSchema } from '@/models/json-schema/drive-file.js';
import { packedDriveFolderSchema } from '@/models/json-schema/drive-folder.js';
import { packedFollowingSchema } from '@/models/json-schema/following.js';
import { packedMutingSchema } from '@/models/json-schema/muting.js';
import { packedRenoteMutingSchema } from '@/models/json-schema/renote-muting.js';
import { packedBlockingSchema } from '@/models/json-schema/blocking.js';
import { packedNoteReactionSchema } from '@/models/json-schema/note-reaction.js';
import { packedHashtagSchema } from '@/models/json-schema/hashtag.js';
import { packedInviteCodeSchema } from '@/models/json-schema/invite-code.js';
import { packedPageSchema } from '@/models/json-schema/page.js';
import { packedNoteFavoriteSchema } from '@/models/json-schema/note-favorite.js';
import { packedChannelSchema } from '@/models/json-schema/channel.js';
import { packedAntennaSchema } from '@/models/json-schema/antenna.js';
import { packedClipSchema } from '@/models/json-schema/clip.js';
import { packedFederationInstanceSchema } from '@/models/json-schema/federation-instance.js';
import { packedQueueCountSchema } from '@/models/json-schema/queue.js';
import { packedGalleryPostSchema } from '@/models/json-schema/gallery-post.js';
import { packedEmojiDetailedSchema, packedEmojiSimpleSchema } from '@/models/json-schema/emoji.js';
import { packedFlashSchema } from '@/models/json-schema/flash.js';

export const refs = {
	UserLite: packedUserLiteSchema,
	UserDetailedNotMeOnly: packedUserDetailedNotMeOnlySchema,
	MeDetailedOnly: packedMeDetailedOnlySchema,
	UserDetailedNotMe: packedUserDetailedNotMeSchema,
	MeDetailed: packedMeDetailedSchema,
	UserDetailed: packedUserDetailedSchema,
	User: packedUserSchema,

	UserList: packedUserListSchema,
	App: packedAppSchema,
	Note: packedNoteSchema,
	NoteReaction: packedNoteReactionSchema,
	NoteFavorite: packedNoteFavoriteSchema,
	Notification: packedNotificationSchema,
	DriveFile: packedDriveFileSchema,
	DriveFolder: packedDriveFolderSchema,
	Following: packedFollowingSchema,
	Muting: packedMutingSchema,
	RenoteMuting: packedRenoteMutingSchema,
	Blocking: packedBlockingSchema,
	Hashtag: packedHashtagSchema,
	InviteCode: packedInviteCodeSchema,
	Page: packedPageSchema,
	Channel: packedChannelSchema,
	QueueCount: packedQueueCountSchema,
	Antenna: packedAntennaSchema,
	Clip: packedClipSchema,
	FederationInstance: packedFederationInstanceSchema,
	GalleryPost: packedGalleryPostSchema,
	EmojiSimple: packedEmojiSimpleSchema,
	EmojiDetailed: packedEmojiDetailedSchema,
	Flash: packedFlashSchema,
};

type TypeStringef = 'null' | 'boolean' | 'integer' | 'number' | 'string' | 'array' | 'object' | 'any';
type StringDefToType<T extends TypeStringef> =
	T extends 'null' ? null :
	T extends 'boolean' ? boolean :
	T extends 'integer' ? number :
	T extends 'number' ? number :
	T extends 'string' ? string | Date :
	T extends 'array' ? ReadonlyArray<any> :
	T extends 'object' ? Record<string, any> :
	any;

// https://swagger.io/specification/?sbsearch=optional#schema-object
type OfSchema = {
	readonly anyOf?: ReadonlyArray<Schema>;
	readonly oneOf?: ReadonlyArray<Schema>;
	readonly allOf?: ReadonlyArray<Schema>;
}

export interface Schema extends OfSchema {
	readonly type?: TypeStringef;
	readonly nullable?: boolean;
	readonly optional?: boolean;
	readonly items?: Schema;
	readonly properties?: Record<string, Schema>;
	readonly required?: ReadonlyArray<Extract<keyof NonNullable<this['properties']>, string>>;
	readonly description?: string;
	readonly example?: any;
	readonly format?: string;
	readonly ref?: keyof typeof refs;
	readonly enum?: ReadonlyArray<string | null>;
	readonly default?: (this['type'] extends TypeStringef ? StringDefToType<this['type']> : any) | null;
	readonly maxLength?: number;
	readonly minLength?: number;
	readonly maximum?: number;
	readonly minimum?: number;
	readonly pattern?: string;
}
