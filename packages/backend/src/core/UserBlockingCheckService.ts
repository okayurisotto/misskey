import { Injectable } from '@nestjs/common';
import { CacheService } from '@/core/CacheService.js';

@Injectable()
export class UserBlockingCheckService {
	constructor(private readonly cacheService: CacheService) {}

	public async check(
		blockerId: string,
		blockeeId: string,
	): Promise<boolean> {
		return (await this.cacheService.userBlockingCache.fetch(blockerId)).has(
			blockeeId,
		);
	}
}
