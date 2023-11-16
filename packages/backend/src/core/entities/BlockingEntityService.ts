import { Injectable } from '@nestjs/common';
import { pick } from 'omick';
import type { BlockingSchema } from '@/models/zod/BlockingSchema.js';
import { UserEntityService } from './UserEntityService.js';
import type z from 'zod';
import type { blocking, user } from '@prisma/client';

@Injectable()
export class BlockingEntityService {
	constructor(private readonly userEntityService: UserEntityService) {}

	/**
	 * `blocking`をpackする。
	 *
	 * @param blocking
	 * @param me
	 * @returns
	 */
	public async pack(
		blocking: blocking,
		me?: { id: user['id'] } | null | undefined,
	): Promise<z.infer<typeof BlockingSchema>> {
		return {
			...pick(blocking, ['id', 'blockeeId']),
			createdAt: blocking.createdAt.toISOString(),
			blockee: await this.userEntityService.packDetailed(
				blocking.blockeeId,
				me,
			),
		};
	}
}
