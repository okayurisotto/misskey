export class MemorySingleCache<T extends Awaited<unknown>> {
	private timestamp: number | null = null;
	private value: T | undefined = undefined;

	constructor(private readonly lifetime: number | null = null) {}

	private isExpired(timestamp: number, now?: number): boolean {
		if (this.lifetime === null) return false;
		return (now ?? Date.now()) - timestamp > this.lifetime;
	}

	public set(value: T): void {
		this.timestamp = Date.now();
		this.value = value;
	}

	public get(): T | undefined {
		if (this.timestamp === null) {
			return undefined;
		}

		const isExpired = this.isExpired(this.timestamp);
		if (isExpired) {
			this.value = undefined;
			this.timestamp = null;
			return undefined;
		}
		return this.value;
	}

	public delete(): void {
		this.value = undefined;
		this.timestamp = null;
	}
}
