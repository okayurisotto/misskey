import { MemoryKVCache } from './MemoryKVCache.js';

export class MemoryKVCacheFC<
	T extends Awaited<unknown>,
	U,
	V extends T | undefined = T,
> {
	public readonly cache;
	private readonly toCacheConverter;
	private readonly fromCacheConverter;

	constructor(
		lifetime: number | null = null,
		private readonly fetcher: (key: string) => Promise<V>,
		converters: {
			toCache: (value: T) => U;
			fromCache: (cached: U) => T | undefined;
		},
	) {
		this.cache = new MemoryKVCache<U>(lifetime);

		this.toCacheConverter = converters.toCache;
		this.fromCacheConverter = converters.fromCache;
	}

	public set(key: string, value: T): void {
		this.cache.set(key, this.toCacheConverter(value));
	}

	public get(key: string): T | undefined {
		const cached = this.cache.get(key);
		if (cached === undefined) {
			return undefined;
		}

		return this.fromCacheConverter(cached);
	}

	public delete(key: string): void {
		this.cache.delete(key);
	}

	/**
	 * キャッシュがあればそれを返し、なければ`fetcher`を呼び出して結果をキャッシュした上で返す。
	 */
	public async fetch(key: string): Promise<T | V> {
		const cachedValue = this.get(key);
		if (cachedValue === undefined) {
			// Cache MISS
			const value = await this.fetcher(key);
			if (value !== undefined) {
				this.set(key, value);
			}
			return value;
		} else {
			// Cache HIT
			return cachedValue;
		}
	}

	public gc(): void {
		this.cache.gc();
	}

	public dispose(): void {
		this.cache.dispose();
	}
}
