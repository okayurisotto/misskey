import { Injectable } from '@nestjs/common';
import { CacheService } from '@/core/CacheService.js';
import type { user } from '@prisma/client';

@Injectable()
export class UserBlockingCheckService {
	constructor(private readonly cacheService: CacheService) {}

	public async check(
		blockerId: user['id'],
		blockeeId: user['id'],
	): Promise<boolean> {
		return (await this.cacheService.userBlockingCache.fetch(blockerId)).has(
			blockeeId,
		);
	}
}
