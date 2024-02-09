import { MemoryKVCache } from './MemoryKVCache.js';

export class MemoryKVCacheF<
	T extends Awaited<unknown>,
	V extends T | undefined = T,
> extends MemoryKVCache<T> {
	constructor(
		lifetime: number | null = null,
		private readonly fetcher: (key: string) => Promise<V>,
	) {
		super(lifetime);
	}

	/**
	 * キャッシュがあればそれを返し、なければ`this.fetcher`を呼び出して結果をキャッシュした上で返す。
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
}
