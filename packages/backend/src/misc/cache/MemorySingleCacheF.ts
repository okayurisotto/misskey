import { MemorySingleCache } from './MemorySingleCache.js';

export class MemorySingleCacheF<
	T extends Awaited<unknown>,
	U extends T | undefined = T,
> extends MemorySingleCache<T> {
	constructor(
		lifetime: number | null,
		private readonly fetcher: () => Promise<U>,
	) {
		super(lifetime);
	}

	/**
	 * キャッシュがあればそれを返し、無ければ`this.fetcher`を呼び出して結果をキャッシュした上で返す。
	 */
	public async fetch(): Promise<T | U> {
		const cachedValue = this.get();
		if (cachedValue === undefined) {
			// Cache MISS
			const value = await this.fetcher();
			if (value !== undefined) {
				this.set(value);
			}
			return value;
		} else {
			// Cache HIT
			return cachedValue;
		}
	}
}
