// https://github.com/typeorm/typeorm/issues/2400
import pg from 'pg';
pg.types.setTypeParser(20, Number);

import {
	Injectable,
	type OnApplicationBootstrap,
	type OnApplicationShutdown,
} from '@nestjs/common';
import { DataSource, Logger } from 'typeorm';
import * as highlight from 'cli-highlight';
import { NODE_ENV } from '@/env.js';
import MisskeyLogger from '@/misc/logger.js';
import { entities as charts } from '@/core/chart/entities.js';

import { AbuseUserReport } from '@/models/entities/AbuseUserReport.js';
import { AccessToken } from '@/models/entities/AccessToken.js';
import { Ad } from '@/models/entities/Ad.js';
import { Announcement } from '@/models/entities/Announcement.js';
import { AnnouncementRead } from '@/models/entities/AnnouncementRead.js';
import { Antenna } from '@/models/entities/Antenna.js';
import { App } from '@/models/entities/App.js';
import { AttestationChallenge } from '@/models/entities/AttestationChallenge.js';
import { AuthSession } from '@/models/entities/AuthSession.js';
import { Blocking } from '@/models/entities/Blocking.js';
import { ChannelFollowing } from '@/models/entities/ChannelFollowing.js';
import { ChannelFavorite } from '@/models/entities/ChannelFavorite.js';
import { Clip } from '@/models/entities/Clip.js';
import { ClipNote } from '@/models/entities/ClipNote.js';
import { ClipFavorite } from '@/models/entities/ClipFavorite.js';
import { DriveFile } from '@/models/entities/DriveFile.js';
import { DriveFolder } from '@/models/entities/DriveFolder.js';
import { Emoji } from '@/models/entities/Emoji.js';
import { Following } from '@/models/entities/Following.js';
import { FollowRequest } from '@/models/entities/FollowRequest.js';
import { GalleryLike } from '@/models/entities/GalleryLike.js';
import { GalleryPost } from '@/models/entities/GalleryPost.js';
import { Hashtag } from '@/models/entities/Hashtag.js';
import { Instance } from '@/models/entities/Instance.js';
import { Meta } from '@/models/entities/Meta.js';
import { ModerationLog } from '@/models/entities/ModerationLog.js';
import { MutedNote } from '@/models/entities/MutedNote.js';
import { Muting } from '@/models/entities/Muting.js';
import { RenoteMuting } from '@/models/entities/RenoteMuting.js';
import { Note } from '@/models/entities/Note.js';
import { NoteFavorite } from '@/models/entities/NoteFavorite.js';
import { NoteReaction } from '@/models/entities/NoteReaction.js';
import { NoteThreadMuting } from '@/models/entities/NoteThreadMuting.js';
import { NoteUnread } from '@/models/entities/NoteUnread.js';
import { Page } from '@/models/entities/Page.js';
import { PageLike } from '@/models/entities/PageLike.js';
import { PasswordResetRequest } from '@/models/entities/PasswordResetRequest.js';
import { Poll } from '@/models/entities/Poll.js';
import { PollVote } from '@/models/entities/PollVote.js';
import { PromoNote } from '@/models/entities/PromoNote.js';
import { PromoRead } from '@/models/entities/PromoRead.js';
import { RegistrationTicket } from '@/models/entities/RegistrationTicket.js';
import { RegistryItem } from '@/models/entities/RegistryItem.js';
import { Relay } from '@/models/entities/Relay.js';
import { Signin } from '@/models/entities/Signin.js';
import { SwSubscription } from '@/models/entities/SwSubscription.js';
import { UsedUsername } from '@/models/entities/UsedUsername.js';
import { User } from '@/models/entities/User.js';
import { UserIp } from '@/models/entities/UserIp.js';
import { UserKeypair } from '@/models/entities/UserKeypair.js';
import { UserList } from '@/models/entities/UserList.js';
import { UserListFavorite } from '@/models/entities/UserListFavorite.js';
import { UserListJoining } from '@/models/entities/UserListJoining.js';
import { UserNotePining } from '@/models/entities/UserNotePining.js';
import { UserPending } from '@/models/entities/UserPending.js';
import { UserProfile } from '@/models/entities/UserProfile.js';
import { UserPublickey } from '@/models/entities/UserPublickey.js';
import { UserSecurityKey } from '@/models/entities/UserSecurityKey.js';
import { Webhook } from '@/models/entities/Webhook.js';
import { Channel } from '@/models/entities/Channel.js';
import { RetentionAggregation } from '@/models/entities/RetentionAggregation.js';
import { Role } from '@/models/entities/Role.js';
import { RoleAssignment } from '@/models/entities/RoleAssignment.js';
import { Flash } from '@/models/entities/Flash.js';
import { FlashLike } from '@/models/entities/FlashLike.js';
import { UserMemo } from '@/models/entities/UserMemo.js';
import { ConfigLoaderService } from '@/ConfigLoaderService.js';

const dbLogger = new MisskeyLogger('db');

const sqlLogger = dbLogger.createSubLogger('sql', 'gray');

class TypeORMLogger implements Logger {
	private highlight(sql: string): string {
		return highlight.highlight(sql, {
			language: 'sql',
			ignoreIllegals: true,
		});
	}

	public logQuery(query: string): void {
		sqlLogger.info(this.highlight(query).substring(0, 100));
	}

	public logQueryError(error: string, query: string): void {
		sqlLogger.error(this.highlight(query));
	}

	public logQuerySlow(time: number, query: string): void {
		sqlLogger.warn(this.highlight(query));
	}

	public logSchemaBuild(message: string): void {
		sqlLogger.info(message);
	}

	public log(message: string): void {
		sqlLogger.info(message);
	}

	public logMigration(message: string): void {
		sqlLogger.info(message);
	}
}

export const entities = [
	Announcement,
	AnnouncementRead,
	Meta,
	Instance,
	App,
	AuthSession,
	AccessToken,
	User,
	UserProfile,
	UserKeypair,
	UserPublickey,
	UserList,
	UserListFavorite,
	UserListJoining,
	UserNotePining,
	UserSecurityKey,
	UsedUsername,
	AttestationChallenge,
	Following,
	FollowRequest,
	Muting,
	RenoteMuting,
	Blocking,
	Note,
	NoteFavorite,
	NoteReaction,
	NoteThreadMuting,
	NoteUnread,
	Page,
	PageLike,
	GalleryPost,
	GalleryLike,
	DriveFile,
	DriveFolder,
	Poll,
	PollVote,
	Emoji,
	Hashtag,
	SwSubscription,
	AbuseUserReport,
	RegistrationTicket,
	Signin,
	ModerationLog,
	Clip,
	ClipNote,
	ClipFavorite,
	Antenna,
	PromoNote,
	PromoRead,
	Relay,
	MutedNote,
	Channel,
	ChannelFollowing,
	ChannelFavorite,
	RegistryItem,
	Ad,
	PasswordResetRequest,
	UserPending,
	Webhook,
	UserIp,
	RetentionAggregation,
	Role,
	RoleAssignment,
	Flash,
	FlashLike,
	UserMemo,
	...charts,
];

@Injectable()
export class TypeORMService
	extends DataSource
	implements OnApplicationBootstrap, OnApplicationShutdown
{
	constructor(configLoaderService: ConfigLoaderService) {
		const isNotProduction = NODE_ENV !== 'production';
		const isTest = NODE_ENV === 'test';

		super({
			type: 'postgres',
			host: configLoaderService.data.db.host,
			port: configLoaderService.data.db.port,
			username: configLoaderService.data.db.user,
			password: configLoaderService.data.db.pass,
			database: configLoaderService.data.db.db,
			extra: {
				statement_timeout: 1000 * 10,
			},
			synchronize: isTest,
			dropSchema: isTest,
			logging: isNotProduction,
			logger: isNotProduction ? new TypeORMLogger() : undefined,
			maxQueryExecutionTime: 300,
			entities: entities,
			migrations: ['../../migration/*.js'],
		});
	}

	public async onApplicationBootstrap(): Promise<void> {
		await this.initialize();
	}

	public async onApplicationShutdown(): Promise<void> {
		await this.destroy();
	}
}
