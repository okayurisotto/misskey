import * as Redis from 'ioredis';
import { MemoryKVCache } from './MemoryKVCache.js';

export class RedisKVCache<T> {
	private readonly lifetime;
	private readonly memoryCache;
	private readonly fetcher;
	private readonly toRedisConverter;
	private readonly fromRedisConverter;

	constructor(
		private readonly redisClient: Redis.Redis,
		private readonly name: string,
		opts: {
			lifetime: number;
			memoryCacheLifetime: number;
			fetcher: (key: string) => Promise<T>;
			toRedisConverter: (value: T) => string;
			fromRedisConverter: (value: string) => T | undefined;
		},
	) {
		this.lifetime = opts.lifetime;
		this.memoryCache = new MemoryKVCache<T>(opts.memoryCacheLifetime);
		this.fetcher = opts.fetcher;
		this.toRedisConverter = opts.toRedisConverter;
		this.fromRedisConverter = opts.fromRedisConverter;
	}

	public async set(key: string, value: T): Promise<void> {
		this.memoryCache.set(key, value);
		if (this.lifetime === Infinity) {
			await this.redisClient.set(
				`kvcache:${this.name}:${key}`,
				this.toRedisConverter(value),
			);
		} else {
			await this.redisClient.set(
				`kvcache:${this.name}:${key}`,
				this.toRedisConverter(value),
				'EX',
				Math.round(this.lifetime / 1000),
			);
		}
	}

	public async get(key: string): Promise<T | undefined> {
		const memoryCached = this.memoryCache.get(key);
		if (memoryCached !== undefined) return memoryCached;

		const cached = await this.redisClient.get(`kvcache:${this.name}:${key}`);
		if (cached == null) return undefined;
		return this.fromRedisConverter(cached);
	}

	public async delete(key: string): Promise<void> {
		this.memoryCache.delete(key);
		await this.redisClient.del(`kvcache:${this.name}:${key}`);
	}

	/**
	 * キャッシュがあればそれを返し、無ければfetcherを呼び出して結果をキャッシュ&返します
	 */
	public async fetch(key: string): Promise<T> {
		const cachedValue = await this.get(key);
		if (cachedValue !== undefined) {
			// Cache HIT
			return cachedValue;
		}

		// Cache MISS
		const value = await this.fetcher(key);
		this.set(key, value);
		return value;
	}

	public async refresh(key: string): Promise<void> {
		const value = await this.fetcher(key);
		this.set(key, value);

		// TODO: イベント発行して他プロセスのメモリキャッシュも更新できるようにする
	}

	public gc(): void {
		this.memoryCache.gc();
	}

	public dispose(): void {
		this.memoryCache.dispose();
	}
}
