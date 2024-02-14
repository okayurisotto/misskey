import { promisify } from 'node:util';
import { Injectable } from '@nestjs/common';
import redisLock from 'redis-lock';
import { RedisService } from '@/core/RedisService.js';

/**
 * Retry delay (ms) for lock acquisition
 */
const RETRY_DELAY = 100;

@Injectable()
export class AppLockService {
	private readonly lock: (
		key: string,
		timeout?: number,
		_?: (() => Promise<void>) | undefined,
	) => Promise<() => void>;

	constructor(private readonly redisClient: RedisService) {
		this.lock = promisify(redisLock(this.redisClient, RETRY_DELAY));
	}

	/**
	 * Get AP Object lock
	 * @param uri AP object ID
	 * @param timeout Lock timeout (ms), The timeout releases previous lock.
	 * @returns Unlock function
	 */
	public getApLock(uri: string, timeout = 30 * 1000): Promise<() => void> {
		return this.lock(`ap-object:${uri}`, timeout);
	}

	public getChartInsertLock(
		lockKey: string,
		timeout = 30 * 1000,
	): Promise<() => void> {
		return this.lock(`chart-insert:${lockKey}`, timeout);
	}
}
