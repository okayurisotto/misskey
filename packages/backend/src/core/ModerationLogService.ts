import { Injectable } from '@nestjs/common';
import { IdService } from '@/core/IdService.js';
import { bindThis } from '@/decorators.js';
import { PrismaService } from '@/core/PrismaService.js';
import type { user } from '@prisma/client';

@Injectable()
export class ModerationLogService {
	constructor(
		private readonly idService: IdService,
		private readonly prismaService: PrismaService,
	) {}

	@bindThis
	public async insertModerationLog(moderator: { id: user['id'] }, type: string, info?: Record<string, any>) {
		await this.prismaService.client.moderation_log.create({
			data: {
				id: this.idService.genId(),
				createdAt: new Date(),
				userId: moderator.id,
				type: type,
				info: info ?? {},
			}
		});
	}
}
