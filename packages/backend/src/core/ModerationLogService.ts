import { Injectable } from '@nestjs/common';
import { IdService } from '@/core/IdService.js';
import { PrismaService } from '@/core/PrismaService.js';
import type { user } from '@prisma/client';

@Injectable()
export class ModerationLogService {
	constructor(
		private readonly idService: IdService,
		private readonly prismaService: PrismaService,
	) {}

	public async insertModerationLog(
		moderator: Pick<user, 'id'>,
		type: string,
		info?: Record<string, any>,
	): Promise<void> {
		await this.prismaService.client.moderationLog.create({
			data: {
				id: this.idService.genId(),
				createdAt: new Date(),
				userId: moderator.id,
				type: type,
				info: info ?? {},
			},
		});
	}
}
