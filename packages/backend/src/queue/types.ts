import type { IActivity } from '@/core/activitypub/type.js';
import type { ExportedAntennaSchema } from '@/models/zod/ExportedAntenna.js';
import type httpSignature from '@peertube/http-signature';
import type { note, webhook, drive_file, user } from '@prisma/client';
import type { z } from 'zod';

export type DeliverJobData = {
	/** Actor */
	user: ThinUser;
	/** Activity */
	content: unknown;
	/** inbox URL to deliver */
	to: string;
	/** whether it is sharedInbox */
	isSharedInbox: boolean;
};

export type InboxJobData = {
	activity: IActivity;
	signature: httpSignature.IParsedSignature;
};

export type RelationshipJobData = {
	from: ThinUser;
	to: ThinUser;
	silent?: boolean;
	requestId?: string;
};

export type DbJobData<T extends keyof DbJobMap> = DbJobMap[T];

export type DbJobMap = {
	deleteDriveFiles: DbJobDataWithUser;
	exportCustomEmojis: DbJobDataWithUser;
	exportAntennas: DBExportAntennasData;
	exportNotes: DbJobDataWithUser;
	exportFavorites: DbJobDataWithUser;
	exportFollowing: DbExportFollowingData;
	exportMuting: DbJobDataWithUser;
	exportBlocking: DbJobDataWithUser;
	exportUserLists: DbJobDataWithUser;
	importAntennas: DBAntennaImportJobData;
	importFollowing: DbUserImportJobData;
	importFollowingToDb: DbUserImportToDbJobData;
	importMuting: DbUserImportJobData;
	importBlocking: DbUserImportJobData;
	importBlockingToDb: DbUserImportToDbJobData;
	importUserLists: DbUserImportJobData;
	importCustomEmojis: DbUserImportJobData;
	deleteAccount: DbUserDeleteJobData;
};

export type DbJobDataWithUser = {
	user: ThinUser;
};

export type DbExportFollowingData = {
	user: ThinUser;
	excludeMuting: boolean;
	excludeInactive: boolean;
};

export type DBExportAntennasData = {
	user: ThinUser;
};

export type DbUserDeleteJobData = {
	user: ThinUser;
	soft?: boolean;
};

export type DbUserImportJobData = {
	user: ThinUser;
	fileId: drive_file['id'];
};

export type DBAntennaImportJobData = {
	user: ThinUser;
	antenna: z.infer<typeof ExportedAntennaSchema>[];
};

export type DbUserImportToDbJobData = {
	user: ThinUser;
	target: string;
};

export type ObjectStorageJobData =
	| ObjectStorageFileJobData
	| Record<string, unknown>;

export type ObjectStorageFileJobData = {
	key: string;
};

export type EndedPollNotificationJobData = {
	noteId: note['id'];
};

export type WebhookDeliverJobData = {
	type: string;
	content: unknown;
	webhookId: webhook['id'];
	userId: user['id'];
	to: string;
	secret: string;
	createdAt: number;
	eventId: string;
};

export type ThinUser = {
	id: user['id'];
};
