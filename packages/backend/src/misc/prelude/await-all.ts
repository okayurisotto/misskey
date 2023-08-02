import type { UnionToIntersection } from 'type-fest';

const toEntries = <T extends Record<string, unknown>>(
	record: T,
): readonly { [K in keyof T]: readonly [K, T[K]] }[keyof T][] => {
	return Object.entries(record) as readonly {
		[K in keyof T]: readonly [K, T[K]];
	}[keyof T][];
};

type EntryUnion2ObjectUnion<T extends readonly [string, unknown]> =
	T extends unknown ? { [_ in T[0]]: T[1] } : never;

const fromEntries = <T extends readonly (readonly [string, unknown])[]>(
	entries: [...T],
): UnionToIntersection<EntryUnion2ObjectUnion<T[number]>> => {
	return Object.fromEntries(entries) as UnionToIntersection<
		EntryUnion2ObjectUnion<T[number]>
	>;
};

export const awaitAll = async <
	T extends Record<string, () => Promise<unknown>>,
>(
	data: T,
): Promise<
	UnionToIntersection<
		EntryUnion2ObjectUnion<
			{
				[K in keyof T]: K extends string
					? [K, Awaited<ReturnType<T[K]>>]
					: never;
			}[keyof T]
		>
	>
> => {
	const entries = toEntries(data);

	const promises = entries.map(async ([k, v]) => {
		return [k, await v()];
	}) as {
		[K in keyof T]: Promise<[K, Awaited<ReturnType<T[K]>>]>;
	}[keyof T][];

	const awaited = (await Promise.all(promises)) as {
		[K in keyof T]: K extends string
			? Awaited<Promise<[K, Awaited<ReturnType<T[K]>>]>>
			: never;
	}[keyof T][];

	return fromEntries(awaited);
};
