export const includes = <T extends unknown[]>(
  values: readonly [...T],
  target: unknown,
): target is T[number] => {
  return values.includes(target);
};
