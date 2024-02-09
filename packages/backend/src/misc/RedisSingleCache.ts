import * as Redis from 'ioredis';
import { MemorySingleCache } from './MemorySingleCache.js';

export class RedisSingleCache<T> {
	private readonly redisClient: Redis.Redis;
	private readonly name;
	private readonly lifetime;
	private readonly memoryCache: MemorySingleCache<T>;
	private readonly fetcher: () => Promise<T>;
	private readonly toRedisConverter: (value: T) => string;
	private readonly fromRedisConverter: (value: string) => T | undefined;

	constructor(
		redisClient: RedisSingleCache<T>['redisClient'],
		name: string,
		opts: {
			lifetime: number;
			memoryCacheLifetime: number;
			fetcher: RedisSingleCache<T>['fetcher'];
			toRedisConverter: RedisSingleCache<T>['toRedisConverter'];
			fromRedisConverter: RedisSingleCache<T>['fromRedisConverter'];
		},
	) {
		this.redisClient = redisClient;
		this.name = name;
		this.lifetime = opts.lifetime;
		this.memoryCache = new MemorySingleCache(opts.memoryCacheLifetime);
		this.fetcher = opts.fetcher;
		this.toRedisConverter = opts.toRedisConverter;
		this.fromRedisConverter = opts.fromRedisConverter;
	}

	public async set(value: T): Promise<void> {
		this.memoryCache.set(value);
		if (this.lifetime === Infinity) {
			await this.redisClient.set(
				`singlecache:${this.name}`,
				this.toRedisConverter(value),
			);
		} else {
			await this.redisClient.set(
				`singlecache:${this.name}`,
				this.toRedisConverter(value),
				'EX',
				Math.round(this.lifetime / 1000),
			);
		}
	}

	public async get(): Promise<T | undefined> {
		const memoryCached = this.memoryCache.get();
		if (memoryCached !== undefined) return memoryCached;

		const cached = await this.redisClient.get(`singlecache:${this.name}`);
		if (cached == null) return undefined;
		return this.fromRedisConverter(cached);
	}

	public async delete(): Promise<void> {
		this.memoryCache.delete();
		await this.redisClient.del(`singlecache:${this.name}`);
	}

	/**
	 * キャッシュがあればそれを返し、無ければfetcherを呼び出して結果をキャッシュ&返します
	 */
	public async fetch(): Promise<T> {
		const cachedValue = await this.get();
		if (cachedValue !== undefined) {
			// Cache HIT
			return cachedValue;
		}

		// Cache MISS
		const value = await this.fetcher();
		this.set(value);
		return value;
	}

	public async refresh(): Promise<void> {
		const value = await this.fetcher();
		this.set(value);

		// TODO: イベント発行して他プロセスのメモリキャッシュも更新できるようにする
	}
}
