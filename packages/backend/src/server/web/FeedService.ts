import { Injectable } from '@nestjs/common';
import { Feed } from 'feed';
import { PrismaService } from '@/core/PrismaService.js';
import { unique } from '@/misc/prelude/array.js';
import { isNotNull } from '@/misc/is-not-null.js';
import type { Acct } from '@/misc/acct.js';
import { ConfigLoaderService } from '@/ConfigLoaderService.js';
import { DriveFilePublicUrlGenerationService } from '@/core/entities/DriveFilePublicUrlGenerationService.js';
import { UserEntityUtilService } from '@/core/entities/UserEntityUtilService.js';

@Injectable()
export class FeedService {
	constructor(
		private readonly configLoaderService: ConfigLoaderService,
		private readonly prismaService: PrismaService,
		private readonly driveFilePublicUrlGenerationService: DriveFilePublicUrlGenerationService,
		private readonly userEntityUtilService: UserEntityUtilService,
	) {}

	public async packFeed(acct: Acct): Promise<Feed | null> {
		const user = await this.prismaService.client.user.findFirst({
			where: {
				usernameLower: acct.username.toLowerCase(),
				host: acct.host,
				isSuspended: false,
			},
			include: {
				userProfile: true,
				notes: {
					where: { renoteId: null, visibility: { in: ['public', 'home'] } },
					orderBy: { createdAt: 'desc' },
					take: 20,
				},
			},
		});
		if (user === null) return null;
		if (user.userProfile === null) return null;

		const author = {
			link: `${this.configLoaderService.data.url}/@${user.username}`,
			name: user.name ?? user.username,
		};

		const feed = new Feed({
			id: author.link,
			title: `${author.name} (@${user.username}@${this.configLoaderService.data.host})`,
			updated: user.notes[0].createdAt,
			generator: 'Misskey',
			description: `${user.notesCount} Notes, ${
				user.userProfile.ffVisibility === 'public' ? user.followingCount : '?'
			} Following, ${
				user.userProfile.ffVisibility === 'public' ? user.followersCount : '?'
			} Followers${
				user.userProfile.description ? ` · ${user.userProfile.description}` : ''
			}`,
			link: author.link,
			image: user.avatarUrl ?? this.userEntityUtilService.getIdenticonUrl(user),
			feedLinks: {
				json: `${author.link}.json`,
				atom: `${author.link}.atom`,
			},
			author,
			copyright: user.name ?? user.username,
		});

		const allFiles = await this.prismaService.client.driveFile.findMany({
			where: {
				id: { in: unique(user.notes.map(({ fileIds }) => fileIds).flat()) },
				type: { startsWith: 'image/' },
			},
		});

		for (const note of user.notes) {
			const file = note.fileIds
				.map((fileId) => allFiles.find((file) => file.id === fileId))
				.filter(isNotNull)
				.at(0);

			feed.addItem({
				title: `New note by ${author.name}`,
				link: `${this.configLoaderService.data.url}/notes/${note.id}`,
				date: note.createdAt,
				description: note.cw ?? undefined,
				content: note.text ?? undefined,
				image: file
					? this.driveFilePublicUrlGenerationService.generate(file)
					: undefined,
			});
		}

		return feed;
	}
}
