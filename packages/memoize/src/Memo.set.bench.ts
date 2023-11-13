import { bench } from 'vitest';
import { Memo } from './Memo.js';

{
	const map = new Map<number, string>();

	bench('native Map - set', () => {
		for (let i = 0; i < 100; i++) {
			map.set(i, i.toString());
		}
	});
}

{
	const limit = 50;
	const memo = new Memo<number, string>(limit);

	bench('Memo - set', () => {
		for (let i = 0; i < 100; i++) {
			memo.set(i, i.toString());
		}
	});
}
