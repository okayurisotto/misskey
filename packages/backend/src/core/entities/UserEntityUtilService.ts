import { Injectable } from '@nestjs/common';
import { USER_ACTIVE_THRESHOLD, USER_ONLINE_THRESHOLD } from '@/const.js';
import type {
	LocalUser,
	PartialLocalUser,
	PartialRemoteUser,
	RemoteUser,
} from '@/models/entities/User.js';
import { ConfigLoaderService } from '@/ConfigLoaderService.js';
import type { User } from '@prisma/client';

function isLocalUser(user: User): user is LocalUser;
function isLocalUser<T extends { host: User['host'] }>(
	user: T,
): user is T & { host: null };
function isLocalUser(user: User | { host: User['host'] }): boolean {
	return user.host === null;
}

function isRemoteUser(user: User): user is RemoteUser;
function isRemoteUser<T extends { host: User['host'] }>(
	user: T,
): user is T & { host: string };
function isRemoteUser(user: User | { host: User['host'] }): boolean {
	return !isLocalUser(user);
}

@Injectable()
export class UserEntityUtilService {
	constructor(private readonly configLoaderService: ConfigLoaderService) {}

	public isLocalUser = isLocalUser;
	public isRemoteUser = isRemoteUser;

	public getOnlineStatus(
		user: User,
	): 'unknown' | 'online' | 'active' | 'offline' {
		if (user.hideOnlineStatus) return 'unknown';
		if (user.lastActiveDate == null) return 'unknown';
		const elapsed = Date.now() - user.lastActiveDate.getTime();
		return elapsed < USER_ONLINE_THRESHOLD
			? 'online'
			: elapsed < USER_ACTIVE_THRESHOLD
			? 'active'
			: 'offline';
	}

	public getIdenticonUrl(user: User): string {
		return `${
			this.configLoaderService.data.url
		}/identicon/${user.username.toLowerCase()}@${
			user.host ?? this.configLoaderService.data.host
		}`;
	}

	public getUserUri(
		user: LocalUser | PartialLocalUser | RemoteUser | PartialRemoteUser,
	): string {
		if (this.isRemoteUser(user)) return user.uri;
		return this.genLocalUserUri(user.id);
	}

	public genLocalUserUri(userId: string): string {
		return `${this.configLoaderService.data.url}/users/${userId}`;
	}
}
