import { Injectable } from '@nestjs/common';
import { bindThis } from '@/decorators.js';
import type { UserDetailedSchema } from '@/models/zod/UserDetailedSchema.js';
import { UserEntityService } from './UserEntityService.js';
import type { moderation_log, user } from '@prisma/client';
import type { z } from 'zod';

@Injectable()
export class ModerationLogEntityService {
	constructor(private readonly userEntityService: UserEntityService) {}

	/**
	 * `moderation_log`をpackする。
	 *
	 * @param log
	 * @returns
	 */
	@bindThis
	public async pack(
		log: moderation_log,
		ext: { user: user },
	): Promise<{
		id: string;
		createdAt: string;
		type: string;
		info: unknown;
		userId: string;
		user: z.infer<typeof UserDetailedSchema>;
	}> {
		return {
			id: log.id,
			createdAt: log.createdAt.toISOString(),
			type: log.type,
			info: log.info,
			userId: log.userId,
			user: await this.userEntityService.pack(ext.user, null, {
				detail: true,
			}),
		};
	}
}
