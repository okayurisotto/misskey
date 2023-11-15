import { fromEntries, toEntries } from 'omick';
import type { UnionToIntersection } from 'type-fest';

type EntryUnion2ObjectUnion<T extends readonly [string, unknown]> =
	T extends unknown ? { [_ in T[0]]: T[1] } : never;

export const awaitAll = async <T extends Record<string, unknown>>(data: {
	[K in keyof T]: () => Promise<T[K]>;
}): Promise<
	UnionToIntersection<
		EntryUnion2ObjectUnion<
			{
				[K in keyof T]: K extends string ? [K, T[K]] : never;
			}[keyof T]
		>
	>
> => {
	const entries = toEntries(data);

	const promises = entries.map(async ([k, v]) => {
		return [k, await v()];
	}) as {
		[K in keyof T]: Promise<[K, T[K]]>;
	}[keyof T][];

	const awaited = (await Promise.all(promises)) as {
		[K in keyof T]: K extends string ? Awaited<Promise<[K, T[K]]>> : never;
	}[keyof T][];

	return fromEntries(awaited);
};
