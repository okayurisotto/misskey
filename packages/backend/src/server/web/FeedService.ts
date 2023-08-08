import { Inject, Injectable } from '@nestjs/common';
import { Feed } from 'feed';
import { DI } from '@/di-symbols.js';
import type { Config } from '@/config.js';
import type { User } from '@/models/entities/User.js';
import { UserEntityService } from '@/core/entities/UserEntityService.js';
import { DriveFileEntityService } from '@/core/entities/DriveFileEntityService.js';
import { bindThis } from '@/decorators.js';
import type { T2P } from '@/types.js';
import type { user } from '@prisma/client';
import { PrismaService } from '@/core/PrismaService.js';

@Injectable()
export class FeedService {
	constructor(
		@Inject(DI.config)
		private config: Config,

		private userEntityService: UserEntityService,
		private driveFileEntityService: DriveFileEntityService,
		private prismaService: PrismaService,
	) {}

	@bindThis
	public async packFeed(user: T2P<User, user>) {
		const author = {
			link: `${this.config.url}/@${user.username}`,
			name: user.name ?? user.username,
		};

		const profile = await this.prismaService.client.user_profile.findUniqueOrThrow({ where: { userId: user.id } });

		const notes = await this.prismaService.client.note.findMany({
			where: {
				userId: user.id,
				renoteId: null,
				visibility: { in: ['public', 'home'] },
			},
			orderBy: { createdAt: 'desc' },
			take: 20,
		});

		const feed = new Feed({
			id: author.link,
			title: `${author.name} (@${user.username}@${this.config.host})`,
			updated: notes[0].createdAt,
			generator: 'Misskey',
			description: `${user.notesCount} Notes, ${profile.ffVisibility === 'public' ? user.followingCount : '?'} Following, ${profile.ffVisibility === 'public' ? user.followersCount : '?'} Followers${profile.description ? ` · ${profile.description}` : ''}`,
			link: author.link,
			image: user.avatarUrl ?? this.userEntityService.getIdenticonUrl(user),
			feedLinks: {
				json: `${author.link}.json`,
				atom: `${author.link}.atom`,
			},
			author,
			copyright: user.name ?? user.username,
		});

		for (const note of notes) {
			const files = note.fileIds.length > 0 ? await this.prismaService.client.drive_file.findMany({
				where: {
					id: { in: note.fileIds },
				},
			}) : [];
			const file = files.find(file => file.type.startsWith('image/'));

			feed.addItem({
				title: `New note by ${author.name}`,
				link: `${this.config.url}/notes/${note.id}`,
				date: note.createdAt,
				description: note.cw ?? undefined,
				content: note.text ?? undefined,
				image: file ? this.driveFileEntityService.getPublicUrl(file) ?? undefined : undefined,
			});
		}

		return feed;
	}
}
