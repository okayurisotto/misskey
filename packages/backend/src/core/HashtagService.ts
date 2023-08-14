import { Injectable } from '@nestjs/common';
import { normalizeForSearch } from '@/misc/normalize-for-search.js';
import { IdService } from '@/core/IdService.js';
import { UserEntityService } from '@/core/entities/UserEntityService.js';
import { bindThis } from '@/decorators.js';
import { PrismaService } from '@/core/PrismaService.js';
import type { user } from '@prisma/client';

@Injectable()
export class HashtagService {
	constructor(
		private readonly userEntityService: UserEntityService,
		private readonly idService: IdService,
		private readonly prismaService: PrismaService,
	) {
	}

	@bindThis
	public async updateHashtags(user: { id: user['id']; host: user['host']; }, tags: string[]) {
		for (const tag of tags) {
			await this.updateHashtag(user, tag);
		}
	}

	@bindThis
	public async updateUsertags(user: user, tags: string[]) {
		for (const tag of tags) {
			await this.updateHashtag(user, tag, true, true);
		}

		for (const tag of (user.tags ?? []).filter(x => !tags.includes(x))) {
			await this.updateHashtag(user, tag, true, false);
		}
	}

	@bindThis
	public async updateHashtag(user: { id: user['id']; host: user['host']; }, tag: string, isUserAttached = false, inc = true) {
		tag = normalizeForSearch(tag);

		// TODO: transaction
		const index = await this.prismaService.client.hashtag.findUnique({ where: { name: tag } });

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

			// 更新されたものだけを含めるためにこういった書き方になってしまっている
			const data = isUserAttached
				? {
					...({
						attachedUserIds: [...attachedUserIds],
						attachedUsersCount: attachedUserIds.size,
					}),
					...(isLocalUser ? {
						attachedLocalUserIds: [...attachedLocalUserIds],
						attachedLocalUsersCount: attachedLocalUserIds.size,
					} : {}),
					...(isRemoteUser ? {
						attachedRemoteUserIds: [...attachedRemoteUserIds],
						attachedRemoteUsersCount: attachedRemoteUserIds.size,
					} : {}),
				}
				: {
					...({
						mentionedUserIds: [...mentionedUserIds],
						mentionedUsersCount: mentionedUserIds.size,
					}),
					...(isLocalUser ? {
						mentionedLocalUserIds: [...mentionedLocalUserIds],
						mentionedLocalUsersCount: mentionedLocalUserIds.size,
					} : {}),
					...(isRemoteUser ? {
						mentionedRemoteUserIds: [...mentionedRemoteUserIds],
						mentionedRemoteUsersCount: mentionedRemoteUserIds.size,
					} : {}),
				};

			await this.prismaService.client.hashtag.update({ where: { id: index.id }, data });
		} else {
			if (isUserAttached) {
				await this.prismaService.client.hashtag.create({
					data: {
						id: this.idService.genId(),
						name: tag,
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
				await this.prismaService.client.hashtag.create({
					data: {
						id: this.idService.genId(),
						name: tag,
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
	}
}
