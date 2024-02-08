import { Injectable } from '@nestjs/common';
import { pick } from 'omick';
import { z } from 'zod';
import type { UserLiteSchema } from '@/models/zod/UserLiteSchema.js';
import { PrismaService } from '@/core/PrismaService.js';
import { CustomEmojiPopulateService } from '../CustomEmojiPopulateService.js';
import { BadgeRoleService } from '../BadgeRoleService.js';
import { InstanceEntityService } from './InstanceEntityService.js';
import { DriveFilePublicUrlGenerationService } from './DriveFilePublicUrlGenerationService.js';
import { UserEntityUtilService } from './UserEntityUtilService.js';
import type { instance, user } from '@prisma/client';

@Injectable()
export class UserEntityPackLiteService {
	constructor(
		private readonly badgeRoleService: BadgeRoleService,
		private readonly customEmojiPopulateService: CustomEmojiPopulateService,
		private readonly driveFilePublicUrlGenerationService: DriveFilePublicUrlGenerationService,
		private readonly instanceEntityService: InstanceEntityService,
		private readonly prismaService: PrismaService,
		private readonly userEntityUtilService: UserEntityUtilService,
	) {}

	/**
	 * `user`に`{avatar,banner}Id`があるのに`{avatar,banner}{Url,Blurhash}`がなかった場合に付け加える。
	 */
	private async migrate(user: user): Promise<void> {
		if (user.avatarId !== null && user.avatarUrl === null) {
			const avatar =
				await this.prismaService.client.driveFile.findUniqueOrThrow({
					where: { id: user.avatarId },
				});
			const avatarUrl = this.driveFilePublicUrlGenerationService.generate(
				avatar,
				'avatar',
			);
			await this.prismaService.client.user.update({
				where: { id: user.id },
				data: {
					avatarUrl: avatarUrl,
					avatarBlurhash: avatar.blurhash,
				},
			});
		}

		if (user.bannerId !== null && user.bannerUrl === null) {
			const banner =
				await this.prismaService.client.driveFile.findUniqueOrThrow({
					where: { id: user.bannerId },
				});
			const bannerUrl =
				this.driveFilePublicUrlGenerationService.generate(banner);
			await this.prismaService.client.user.update({
				where: { id: user.id },
				data: {
					bannerUrl: bannerUrl,
					bannerBlurhash: banner.blurhash,
				},
			});
		}
	}

	private async getInstance(user: user): Promise<instance | null> {
		if (user.host === null) return null;

		return await this.prismaService.client.instance.findUniqueOrThrow({
			where: { host: user.host },
		});
	}

	public async packLite(user: user): Promise<z.infer<typeof UserLiteSchema>> {
		await this.migrate(user);

		const [instance, badgeRoles, emojis] = await Promise.all([
			this.getInstance(user),
			this.badgeRoleService.getUserBadgeRoles(user.id),
			this.customEmojiPopulateService.populate(user.emojis, user.host),
		]);

		return {
			...pick(user, [
				'id',
				'name',
				'username',
				'host',
				'avatarBlurhash',
				'isBot',
				'isCat',
			]),
			avatarUrl:
				user.avatarUrl ?? this.userEntityUtilService.getIdenticonUrl(user),
			badgeRoles: badgeRoles.map((role) =>
				pick(role, ['displayOrder', 'iconUrl', 'name']),
			),
			emojis,
			instance:
				instance !== null
					? this.instanceEntityService.packLite(instance)
					: undefined,
			onlineStatus: this.userEntityUtilService.getOnlineStatus(user),
		};
	}
}
