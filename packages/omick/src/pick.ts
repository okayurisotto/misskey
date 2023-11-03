import { ObjectToEntryUnion, toEntries } from "./utils/toEntries.js";
import { fromEntries } from "./utils/fromEntries.js";
import { includes } from "./utils/includes.js";

export const pick = <T extends Record<string, unknown>, U extends (keyof T)[]>(
  data: T,
  keys: U,
) => {
  const entries = toEntries(data);
  const result = entries.filter(([k]) => includes(keys, k));
  return fromEntries(result) as unknown as Pick<T, U[number]>;
};

export const pickBy = <T extends Record<string, unknown>>(
  data: T,
  fn: (entry: ObjectToEntryUnion<T>) => boolean,
) => {
  const entries = toEntries(data);
  const result = entries.filter((entry) => fn(entry));
  return fromEntries(result) as unknown as Partial<T>;
};
