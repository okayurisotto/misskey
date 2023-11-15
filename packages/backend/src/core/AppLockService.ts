import { promisify } from 'node:util';
import { Injectable } from '@nestjs/common';
import redisLock from 'redis-lock';
import { bindThis } from '@/decorators.js';
import { RedisService } from '@/core/RedisService.js';

/**
 * Retry delay (ms) for lock acquisition
 */
const retryDelay = 100;

@Injectable()
export class AppLockService {
	private lock: (key: string, timeout?: number, _?: (() => Promise<void>) | undefined) => Promise<() => void>;

	constructor(
		private redisClient: RedisService,
	) {
		this.lock = promisify(redisLock(this.redisClient, retryDelay));
	}

	/**
	 * Get AP Object lock
	 * @param uri AP object ID
	 * @param timeout Lock timeout (ms), The timeout releases previous lock.
	 * @returns Unlock function
	 */
	@bindThis
	public getApLock(uri: string, timeout = 30 * 1000): Promise<() => void> {
		return this.lock(`ap-object:${uri}`, timeout);
	}

	@bindThis
	public getChartInsertLock(lockKey: string, timeout = 30 * 1000): Promise<() => void> {
		return this.lock(`chart-insert:${lockKey}`, timeout);
	}
}
