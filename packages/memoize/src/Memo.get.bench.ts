import { bench } from 'vitest';
import { Memo } from './Memo.js';

{
	const map = new Map<number, string>();

	for (let i = 0; i < 100; i++) {
		map.set(i, i.toString());
	}

	bench('native Map - get', () => {
		for (let i = 0; i < 100; i++) {
			map.get(i);
		}
	});
}

{
	const limit = 50;
	const memo = new Memo<number, string>(limit);

	for (let i = 0; i < 100; i++) {
		memo.set(i, i.toString());
	}

	bench('Memo - get', () => {
		for (let i = 0; i < 100; i++) {
			memo.get(i);
		}
	});
}
