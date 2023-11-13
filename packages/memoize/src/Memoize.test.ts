import { test, expect } from 'vitest';
import { Memoize } from './Memoize.js';

class Memoized extends Memoize<number, string> {
	public count = 0;

	constructor() {
		super(10);
	}

	protected override serialize(arg: number): number {
		return arg;
	}

	protected override execute(arg: number): string {
		this.count++;
		return arg.toString();
	}
}

test('同じ結果が得られる', () => {
	const memoized = new Memoized();
	const arg = 1;

	const result = memoized.compute(arg);

	expect(memoized.compute(arg)).toBe(result);
});

test('メモが使われている', () => {
	const memoized = new Memoized();
	const arg = 1;

	memoized.compute(arg);
	memoized.compute(arg);

	expect(memoized.count).toBe(1);
});
