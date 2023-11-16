import * as Redis from 'ioredis';

export class RedisKVCache<T> {
	private readonly redisClient: Redis.Redis;
	private readonly name: string;
	private readonly lifetime: number;
	private readonly memoryCache: MemoryKVCache<T>;
	private readonly fetcher: (key: string) => Promise<T>;
	private readonly toRedisConverter: (value: T) => string;
	private readonly fromRedisConverter: (value: string) => T | undefined;

	constructor(redisClient: RedisKVCache<T>['redisClient'], name: RedisKVCache<T>['name'], opts: {
		lifetime: RedisKVCache<T>['lifetime'];
		memoryCacheLifetime: number;
		fetcher: RedisKVCache<T>['fetcher'];
		toRedisConverter: RedisKVCache<T>['toRedisConverter'];
		fromRedisConverter: RedisKVCache<T>['fromRedisConverter'];
	}) {
		this.redisClient = redisClient;
		this.name = name;
		this.lifetime = opts.lifetime;
		this.memoryCache = new MemoryKVCache(opts.memoryCacheLifetime);
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
				'EX', Math.round(this.lifetime / 1000),
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

export class RedisSingleCache<T> {
	private readonly redisClient: Redis.Redis;
	private readonly name: string;
	private readonly lifetime: number;
	private readonly memoryCache: MemorySingleCache<T>;
	private readonly fetcher: () => Promise<T>;
	private readonly toRedisConverter: (value: T) => string;
	private readonly fromRedisConverter: (value: string) => T | undefined;

	constructor(redisClient: RedisSingleCache<T>['redisClient'], name: RedisSingleCache<T>['name'], opts: {
		lifetime: RedisSingleCache<T>['lifetime'];
		memoryCacheLifetime: number;
		fetcher: RedisSingleCache<T>['fetcher'];
		toRedisConverter: RedisSingleCache<T>['toRedisConverter'];
		fromRedisConverter: RedisSingleCache<T>['fromRedisConverter'];
	}) {
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
				'EX', Math.round(this.lifetime / 1000),
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

// TODO: メモリ節約のためあまり参照されないキーを定期的に削除できるようにする？

function nothingToDo<T, V = T>(value: T): V {
	return value as unknown as V;
}

export class MemoryKVCache<T, V = T> {
	public cache: Map<string, { date: number; value: V; }>;
	private readonly lifetime: number;
	private readonly gcIntervalHandle: NodeJS.Timer;
	private readonly toMapConverter: (value: T) => V;
	private readonly fromMapConverter: (cached: V) => T | undefined;

	constructor(lifetime: MemoryKVCache<never>['lifetime'], options: {
		toMapConverter: (value: T) => V;
		fromMapConverter: (cached: V) => T | undefined;
	} = {
		toMapConverter: nothingToDo,
		fromMapConverter: nothingToDo,
	}) {
		this.cache = new Map();
		this.lifetime = lifetime;
		this.toMapConverter = options.toMapConverter;
		this.fromMapConverter = options.fromMapConverter;

		this.gcIntervalHandle = setInterval(() => {
			this.gc();
		}, 1000 * 60 * 3);
	}

	public set(key: string, value: T): void {
		this.cache.set(key, {
			date: Date.now(),
			value: this.toMapConverter(value),
		});
	}

	public get(key: string): T | undefined {
		const cached = this.cache.get(key);
		if (cached == null) return undefined;
		if ((Date.now() - cached.date) > this.lifetime) {
			this.cache.delete(key);
			return undefined;
		}
		return this.fromMapConverter(cached.value);
	}

	public delete(key: string): void {
		this.cache.delete(key);
	}

	/**
	 * キャッシュがあればそれを返し、無ければfetcherを呼び出して結果をキャッシュ&返します
	 * optional: キャッシュが存在してもvalidatorでfalseを返すとキャッシュ無効扱いにします
	 * fetcherの引数はcacheに保存されている値があれば渡されます
	 */
	public async fetch(key: string, fetcher: (value: V | undefined) => Promise<T>, validator?: (cachedValue: T) => boolean): Promise<T> {
		const cachedValue = this.get(key);
		if (cachedValue !== undefined) {
			if (validator) {
				if (validator(cachedValue)) {
					// Cache HIT
					return cachedValue;
				}
			} else {
				// Cache HIT
				return cachedValue;
			}
		}

		// Cache MISS
		const value = await fetcher(this.cache.get(key)?.value);
		this.set(key, value);
		return value;
	}

	/**
	 * キャッシュがあればそれを返し、無ければfetcherを呼び出して結果をキャッシュ&返します
	 * optional: キャッシュが存在してもvalidatorでfalseを返すとキャッシュ無効扱いにします
	 * fetcherの引数はcacheに保存されている値があれば渡されます
	 */
	public async fetchMaybe(key: string, fetcher: (value: V | undefined) => Promise<T | undefined>, validator?: (cachedValue: T) => boolean): Promise<T | undefined> {
		const cachedValue = this.get(key);
		if (cachedValue !== undefined) {
			if (validator) {
				if (validator(cachedValue)) {
					// Cache HIT
					return cachedValue;
				}
			} else {
				// Cache HIT
				return cachedValue;
			}
		}

		// Cache MISS
		const value = await fetcher(this.cache.get(key)?.value);
		if (value !== undefined) {
			this.set(key, value);
		}
		return value;
	}

	public gc(): void {
		const now = Date.now();
		for (const [key, { date }] of this.cache.entries()) {
			if ((now - date) > this.lifetime) {
				this.cache.delete(key);
			}
		}
	}

	public dispose(): void {
		clearInterval(this.gcIntervalHandle);
	}
}

export class MemorySingleCache<T> {
	private cachedAt: number | null = null;
	private value: T | undefined;
	private readonly lifetime: number;

	constructor(lifetime: MemorySingleCache<never>['lifetime']) {
		this.lifetime = lifetime;
	}

	public set(value: T): void {
		this.cachedAt = Date.now();
		this.value = value;
	}

	public get(): T | undefined {
		if (this.cachedAt == null) return undefined;
		if ((Date.now() - this.cachedAt) > this.lifetime) {
			this.value = undefined;
			this.cachedAt = null;
			return undefined;
		}
		return this.value;
	}

	public delete(): void {
		this.value = undefined;
		this.cachedAt = null;
	}

	/**
	 * キャッシュがあればそれを返し、無ければfetcherを呼び出して結果をキャッシュ&返します
	 * optional: キャッシュが存在してもvalidatorでfalseを返すとキャッシュ無効扱いにします
	 */
	public async fetch(fetcher: () => Promise<T>, validator?: (cachedValue: T) => boolean): Promise<T> {
		const cachedValue = this.get();
		if (cachedValue !== undefined) {
			if (validator) {
				if (validator(cachedValue)) {
					// Cache HIT
					return cachedValue;
				}
			} else {
				// Cache HIT
				return cachedValue;
			}
		}

		// Cache MISS
		const value = await fetcher();
		this.set(value);
		return value;
	}

	/**
	 * キャッシュがあればそれを返し、無ければfetcherを呼び出して結果をキャッシュ&返します
	 * optional: キャッシュが存在してもvalidatorでfalseを返すとキャッシュ無効扱いにします
	 */
	public async fetchMaybe(fetcher: () => Promise<T | undefined>, validator?: (cachedValue: T) => boolean): Promise<T | undefined> {
		const cachedValue = this.get();
		if (cachedValue !== undefined) {
			if (validator) {
				if (validator(cachedValue)) {
					// Cache HIT
					return cachedValue;
				}
			} else {
				// Cache HIT
				return cachedValue;
			}
		}

		// Cache MISS
		const value = await fetcher();
		if (value !== undefined) {
			this.set(value);
		}
		return value;
	}
}
