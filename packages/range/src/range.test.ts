import { test, expect } from 'vitest';
import { range } from './range.js';

test('stop', () => {
	expect(range({ stop: 5 })).toStrictEqual([0, 1, 2, 3, 4]);
});

test('start & stop', () => {
	expect(range({ start: -2, stop: 5 })).toStrictEqual([-2, -1, 0, 1, 2, 3, 4]);
});

test('start & stop & step', () => {
	expect(range({ start: -2, stop: 5, step: 2 })).toStrictEqual([-2, 0, 2, 4]);
});

test('negative step', () => {
	expect(range({ start: 7, stop: 2, step: -1 })).toStrictEqual([7, 6, 5, 4, 3]);
});

test('floating step', () => {
	expect(range({ start: 2, stop: 5, step: 1.1 })).toStrictEqual([2, 3.1, 4.2]);
});

test('invalid length', () => {
	expect(() => range({ start: 2, stop: 5, step: -1 })).toThrowError(RangeError);
});
