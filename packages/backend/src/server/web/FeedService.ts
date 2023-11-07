import { Inject, Injectable } from '@nestjs/common';
import { Feed } from 'feed';
import { DI } from '@/di-symbols.js';
import type { Config } from '@/config.js';
import { UserEntityService } from '@/core/entities/UserEntityService.js';
import { DriveFileEntityService } from '@/core/entities/DriveFileEntityService.js';
import { PrismaService } from '@/core/PrismaService.js';
import { unique } from '@/misc/prelude/array.js';
import { isNotNull } from '@/misc/is-not-null.js';
import type { Acct } from '@/misc/acct.js';

@Injectable()
export class FeedService {
	constructor(
		@Inject(DI.config)
		private config: Config,

		private userEntityService: UserEntityService,
		private driveFileEntityService: DriveFileEntityService,
		private prismaService: PrismaService,
	) {}

	public async packFeed(acct: Acct): Promise<Feed | null> {
		const user = await this.prismaService.client.user.findFirst({
			where: {
				usernameLower: acct.username.toLowerCase(),
				host: acct.host,
				isSuspended: false,
			},
			include: {
				user_profile: true,
				note: {
					where: { renoteId: null, visibility: { in: ['public', 'home'] } },
					orderBy: { createdAt: 'desc' },
					take: 20,
				},
			},
		});
		if (user === null) return null;
		if (user.user_profile === null) return null;

		const author = {
			link: `${this.config.url}/@${user.username}`,
			name: user.name ?? user.username,
		};

		const feed = new Feed({
			id: author.link,
			title: `${author.name} (@${user.username}@${this.config.host})`,
			updated: user.note[0].createdAt,
			generator: 'Misskey',
			description: `${user.notesCount} Notes, ${
				user.user_profile.ffVisibility === 'public' ? user.followingCount : '?'
			} Following, ${
				user.user_profile.ffVisibility === 'public' ? user.followersCount : '?'
			} Followers${
				user.user_profile.description
					? ` · ${user.user_profile.description}`
					: ''
			}`,
			link: author.link,
			image: user.avatarUrl ?? this.userEntityService.getIdenticonUrl(user),
			feedLinks: {
				json: `${author.link}.json`,
				atom: `${author.link}.atom`,
			},
			author,
			copyright: user.name ?? user.username,
		});

		const allFiles = await this.prismaService.client.drive_file.findMany({
			where: {
				id: { in: unique(user.note.map(({ fileIds }) => fileIds).flat()) },
				type: { startsWith: 'image/' },
			},
		});

		for (const note of user.note) {
			const file = note.fileIds
				.map((fileId) => allFiles.find((file) => file.id === fileId))
				.filter(isNotNull)
				.at(0);

			feed.addItem({
				title: `New note by ${author.name}`,
				link: `${this.config.url}/notes/${note.id}`,
				date: note.createdAt,
				description: note.cw ?? undefined,
				content: note.text ?? undefined,
				image: file
					? this.driveFileEntityService.getPublicUrl(file)
					: undefined,
			});
		}

		return feed;
	}
}
