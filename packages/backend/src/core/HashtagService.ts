import { Injectable } from '@nestjs/common';
import { normalizeForSearch } from '@/misc/normalize-for-search.js';
import { IdService } from '@/core/IdService.js';
import { UserEntityService } from '@/core/entities/UserEntityService.js';
import { PrismaService } from '@/core/PrismaService.js';
import type { user } from '@prisma/client';

@Injectable()
export class HashtagService {
	constructor(
		private readonly userEntityService: UserEntityService,
		private readonly idService: IdService,
		private readonly prismaService: PrismaService,
	) {}

	public async updateHashtags(user: Pick<user, 'id' | 'host'>, tags: string[]): Promise<void> {
		await Promise.all(tags.map((tag) => this.updateHashtag(user, tag)));
	}

	public async updateUsertags(user: Pick<user, 'id' | 'host' | 'tags'>, tags: string[]): Promise<void> {
		await Promise.all([
			...tags.map((tag) => this.updateHashtag(user, tag, true, true)),
			...user.tags.filter((tag) => !tags.includes(tag)).map((tag) => this.updateHashtag(user, tag, true, false)),
		]);
	}

	public async updateHashtag(
		user: Pick<user, 'id' | 'host'>,
		tag: string,
		isUserAttached = false,
		inc = true,
	): Promise<void> {
		const name = normalizeForSearch(tag);

		await this.prismaService.client.$transaction(async (client) => {
			const index = await client.hashtag.findUnique({ where: { name } });

			if (index === null && !inc) return;

			if (index !== null) {
				const isLocalUser = this.userEntityService.isLocalUser(user);
				const isRemoteUser = this.userEntityService.isRemoteUser(user);

				const attachedUserIds = new Set(index.attachedUserIds);
				const attachedLocalUserIds = new Set(index.attachedLocalUserIds);
				const attachedRemoteUserIds = new Set(index.attachedRemoteUserIds);
				const mentionedUserIds = new Set(index.mentionedUserIds);
				const mentionedLocalUserIds = new Set(index.mentionedLocalUserIds);
				const mentionedRemoteUserIds = new Set(index.mentionedRemoteUserIds);

				if (isUserAttached) {
					if (inc) {
						attachedUserIds.add(user.id);
						if (isLocalUser) attachedLocalUserIds.add(user.id);
						if (isRemoteUser) attachedRemoteUserIds.add(user.id);
					} else {
						attachedUserIds.delete(user.id);
						if (isLocalUser) attachedLocalUserIds.delete(user.id);
						if (isRemoteUser) attachedRemoteUserIds.delete(user.id);
					}
				} else {
					mentionedUserIds.add(user.id);
					if (isLocalUser) mentionedLocalUserIds.add(user.id);
					if (isRemoteUser) mentionedRemoteUserIds.add(user.id);
				}

				await client.hashtag.update({
					where: { id: index.id },
					data: {
						attachedUserIds: [...attachedUserIds],
						attachedUsersCount: attachedUserIds.size,
						attachedLocalUserIds: [...attachedLocalUserIds],
						attachedLocalUsersCount: attachedLocalUserIds.size,
						attachedRemoteUserIds: [...attachedRemoteUserIds],
						attachedRemoteUsersCount: attachedRemoteUserIds.size,
						mentionedUserIds: [...mentionedUserIds],
						mentionedUsersCount: mentionedUserIds.size,
						mentionedLocalUserIds: [...mentionedLocalUserIds],
						mentionedLocalUsersCount: mentionedLocalUserIds.size,
						mentionedRemoteUserIds: [...mentionedRemoteUserIds],
						mentionedRemoteUsersCount: mentionedRemoteUserIds.size,
					},
				});
			} else {
				if (isUserAttached) {
					await client.hashtag.create({
						data: {
							id: this.idService.genId(),
							name,
							mentionedUserIds: [],
							mentionedUsersCount: 0,
							mentionedLocalUserIds: [],
							mentionedLocalUsersCount: 0,
							mentionedRemoteUserIds: [],
							mentionedRemoteUsersCount: 0,
							attachedUserIds: [user.id],
							attachedUsersCount: 1,
							attachedLocalUserIds: this.userEntityService.isLocalUser(user) ? [user.id] : [],
							attachedLocalUsersCount: this.userEntityService.isLocalUser(user) ? 1 : 0,
							attachedRemoteUserIds: this.userEntityService.isRemoteUser(user) ? [user.id] : [],
							attachedRemoteUsersCount: this.userEntityService.isRemoteUser(user) ? 1 : 0,
						}
					});
				} else {
					await client.hashtag.create({
						data: {
							id: this.idService.genId(),
							name,
							mentionedUserIds: [user.id],
							mentionedUsersCount: 1,
							mentionedLocalUserIds: this.userEntityService.isLocalUser(user) ? [user.id] : [],
							mentionedLocalUsersCount: this.userEntityService.isLocalUser(user) ? 1 : 0,
							mentionedRemoteUserIds: this.userEntityService.isRemoteUser(user) ? [user.id] : [],
							mentionedRemoteUsersCount: this.userEntityService.isRemoteUser(user) ? 1 : 0,
							attachedUserIds: [],
							attachedUsersCount: 0,
							attachedLocalUserIds: [],
							attachedLocalUsersCount: 0,
							attachedRemoteUserIds: [],
							attachedRemoteUsersCount: 0,
						}
					});
				}
			}
		});
	}
}
