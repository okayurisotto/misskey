export const isIncludes = <T extends unknown[]>(
	values: readonly [...T],
	value: unknown,
): value is T[number] => {
	return values.includes(value);
};
