import { test, expect } from 'vitest';
import { Memo } from './Memo.js';

test('保存した値が取得できる', () => {
	const memo = new Memo<string, symbol>(10);
	const key = 'key';
	const value = Symbol();

	memo.set(key, value);

	expect(memo.get(key)).toBe(value);
});

test('上限を超えて保存されない', () => {
	const first = 0;
	const limit = 10;
	const memo = new Memo<number, string>(limit);

	for (let i = first; i <= limit + 1; i++) {
		memo.set(i, i.toString());
	}

	expect(memo.get(first)).toBe(undefined);
});
