import { Injectable } from '@nestjs/common';
import type { ModerationLog } from '@/models/entities/ModerationLog.js';
import { bindThis } from '@/decorators.js';
import type { T2P } from '@/types.js';
import { PrismaService } from '@/core/PrismaService.js';
import { UserEntityService } from './UserEntityService.js';
import type { moderation_log } from '@prisma/client';

@Injectable()
export class ModerationLogEntityService {
	constructor(
		private readonly prismaService: PrismaService,
		private readonly userEntityService: UserEntityService,
	) {}

	@bindThis
	public async pack(src: ModerationLog['id'] | T2P<ModerationLog, moderation_log>) {
		const log =
			typeof src === 'object'
				? src
				: await this.prismaService.client.moderation_log.findUniqueOrThrow({ where: { id: src } });

		return {
			id: log.id,
			createdAt: log.createdAt.toISOString(),
			type: log.type,
			info: log.info,
			userId: log.userId,
			user: await this.userEntityService.pack(log.userId, null, {
				detail: true,
			}),
		};
	}
}
