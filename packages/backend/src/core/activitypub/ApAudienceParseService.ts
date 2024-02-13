import { Injectable } from '@nestjs/common';
import promiseLimit from 'promise-limit';
import type { RemoteUser } from '@/models/entities/User.js';
import { concat, unique } from '@/misc/prelude/array.js';
import { getApIds } from './type.js';
import { ApPersonResolveService } from './models/ApPersonResolveService.js';
import type { ApObject } from './type.js';
import type { Resolver } from './ApResolverService.js';
import type { User } from '@prisma/client';

type Visibility = 'public' | 'home' | 'followers' | 'specified';

type AudienceInfo = {
	visibility: Visibility;
	mentionedUsers: User[];
	visibleUsers: User[];
};

type GroupedAudience = Record<'public' | 'followers' | 'other', string[]>;

@Injectable()
export class ApAudienceParseService {
	constructor(
		private readonly apPersonResolveService: ApPersonResolveService,
	) {}

	public async parse(
		actor: RemoteUser,
		to?: ApObject,
		cc?: ApObject,
		resolver?: Resolver,
	): Promise<AudienceInfo> {
		const toGroups = this.groupingAudience(getApIds(to), actor);
		const ccGroups = this.groupingAudience(getApIds(cc), actor);

		const others = unique(concat([toGroups.other, ccGroups.other]));

		const limit = promiseLimit<User | null>(2);
		const mentionedUsers = (
			await Promise.all(
				others.map((id) =>
					limit(() =>
						this.apPersonResolveService.resolve(id, resolver).catch(() => null),
					),
				),
			)
		).filter((x): x is User => x != null);

		if (toGroups.public.length > 0) {
			return {
				visibility: 'public',
				mentionedUsers,
				visibleUsers: [],
			};
		}

		if (ccGroups.public.length > 0) {
			return {
				visibility: 'home',
				mentionedUsers,
				visibleUsers: [],
			};
		}

		if (toGroups.followers.length > 0) {
			return {
				visibility: 'followers',
				mentionedUsers,
				visibleUsers: [],
			};
		}

		return {
			visibility: 'specified',
			mentionedUsers,
			visibleUsers: mentionedUsers,
		};
	}

	private groupingAudience(ids: string[], actor: RemoteUser): GroupedAudience {
		const groups: GroupedAudience = {
			public: [],
			followers: [],
			other: [],
		};

		for (const id of ids) {
			if (this.isPublic(id)) {
				groups.public.push(id);
			} else if (this.isFollowers(id, actor)) {
				groups.followers.push(id);
			} else {
				groups.other.push(id);
			}
		}

		groups.other = unique(groups.other);

		return groups;
	}

	private isPublic(id: string): boolean {
		return [
			'https://www.w3.org/ns/activitystreams#Public',
			'as:Public',
			'Public',
		].includes(id);
	}

	private isFollowers(id: string, actor: RemoteUser): boolean {
		return id === (actor.followersUri ?? `${actor.uri}/followers`);
	}
}
