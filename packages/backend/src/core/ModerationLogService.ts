import { Injectable } from '@nestjs/common';
import type { User } from '@/models/entities/User.js';
import { IdService } from '@/core/IdService.js';
import { bindThis } from '@/decorators.js';
import { PrismaService } from '@/core/PrismaService.js';

@Injectable()
export class ModerationLogService {
	constructor(
		private readonly idService: IdService,
		private readonly prismaService: PrismaService,
	) {}

	@bindThis
	public async insertModerationLog(moderator: { id: User['id'] }, type: string, info?: Record<string, any>) {
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
