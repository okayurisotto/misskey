function nothingToDo<T, V = T>(value: T): V {
	return value as unknown as V;
}

export class MemoryKVCache<T, V = T> {
	public cache: Map<string, { date: number; value: V }>;
	private readonly lifetime: number;
	private readonly gcIntervalHandle: NodeJS.Timer;
	private readonly toMapConverter: (value: T) => V;
	private readonly fromMapConverter: (cached: V) => T | undefined;

	constructor(
		lifetime: MemoryKVCache<never>['lifetime'],
		options: {
			toMapConverter: (value: T) => V;
			fromMapConverter: (cached: V) => T | undefined;
		} = {
			toMapConverter: nothingToDo,
			fromMapConverter: nothingToDo,
		},
	) {
		this.cache = new Map();
		this.lifetime = lifetime;
		this.toMapConverter = options.toMapConverter;
		this.fromMapConverter = options.fromMapConverter;

		this.gcIntervalHandle = setInterval(
			() => {
				this.gc();
			},
			1000 * 60 * 3,
		);
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
		if (Date.now() - cached.date > this.lifetime) {
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
	public async fetch(
		key: string,
		fetcher: (value: V | undefined) => Promise<T>,
		validator?: (cachedValue: T) => boolean,
	): Promise<T> {
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
	public async fetchMaybe(
		key: string,
		fetcher: (value: V | undefined) => Promise<T | undefined>,
		validator?: (cachedValue: T) => boolean,
	): Promise<T | undefined> {
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
			if (now - date > this.lifetime) {
				this.cache.delete(key);
			}
		}
	}

	public dispose(): void {
		clearInterval(this.gcIntervalHandle);
	}
}
