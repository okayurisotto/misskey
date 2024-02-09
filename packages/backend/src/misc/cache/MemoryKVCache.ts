const GC_INTERVAL = 1000 * 60 * 3;

export class MemoryKVCache<T extends Awaited<unknown>> {
	public readonly cache = new Map<string, { timestamp: number; value: T }>();
	private readonly gcTimer: NodeJS.Timer;

	constructor(private readonly lifetime: number | null = null) {
		this.gcTimer = setInterval(() => {
			this.gc();
		}, GC_INTERVAL);
	}

	private isExpired(timestamp: number, now?: number): boolean {
		if (this.lifetime === null) return false;
		return (now ?? Date.now()) - timestamp > this.lifetime;
	}

	public set(key: string, value: T): void {
		const now = Date.now();
		this.cache.set(key, {
			timestamp: now,
			value: value,
		});
	}

	public get(key: string): T | undefined {
		const cached = this.cache.get(key);
		if (cached === undefined) {
			return undefined;
		}

		if (this.isExpired(cached.timestamp)) {
			this.cache.delete(key);
			return undefined;
		}

		return cached.value;
	}

	public delete(key: string): void {
		this.cache.delete(key);
	}

	public gc(): void {
		const now = Date.now();
		for (const [key, { timestamp }] of this.cache.entries()) {
			if (this.isExpired(timestamp, now)) {
				this.cache.delete(key);
			}
		}
	}

	public dispose(): void {
		clearInterval(this.gcTimer);
	}
}
