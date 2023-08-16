class Cache<K extends PropertyKey, V> {
	private readonly cache = new Map<K, V>();

	/**
	 * @param max キャッシュとして保持する件数の上限。これ以上古いものは破棄される。
	 */
	constructor(private readonly max: number) {}

	get(key: K): V | undefined {
		const value = this.cache.get(key);

		if (value) {
			// キャッシュに存在した場合、それを末尾へ移動させることで最近使用したものとしてマークする。
			this.cache.delete(key);
			this.cache.set(key, value);
		}

		return value;
	}

	set(key: K, value: V): void {
		if (this.cache.size >= this.max) {
			// キャッシュの件数が上限に到達する場合、先頭の最も古いものを消す。
			const oldestKey = this.cache.keys().next().value;
			this.cache.delete(oldestKey);
		}

		this.cache.set(key, value);
	}
}

export class Memoize<I, O> {
	private readonly cache: Cache<string, O>;

	/**
	 * @param fn  返り値をメモ化したい処理
	 * @param max キャッシュとして保持する件数の上限。これ以上古いものは破棄される。
	 */
	constructor(
		private readonly fn: (input: I) => O,
		max: number,
	) {
		this.cache = new Cache(max);
	}

	compute(input: I): O {
		const key = JSON.stringify(input);

		const cachedValue = this.cache.get(key);
		if (cachedValue !== undefined) return cachedValue;

		const result = this.fn(input);
		this.cache.set(key, result);
		return result;
	}
}
