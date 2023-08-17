import { ObjectToEntryUnion, toEntries } from "./utils/toEntries.js";
import { fromEntries } from "./utils/fromEntries.js";
import { includes } from "./utils/includes.js";

export const omit = <T extends Record<string, unknown>, U extends (keyof T)[]>(
  data: T,
  keys: U,
) => {
  const entries = toEntries(data);
  const result = entries.filter(([k]) => !includes(keys, k));
  return fromEntries(result) as Omit<T, U[number]>;
};

export const omitBy = <T extends Record<string, unknown>>(
  data: T,
  fn: (entry: ObjectToEntryUnion<T>) => boolean,
) => {
  const entries = toEntries(data);
  const result = entries.filter((entry) => !fn(entry));
  return fromEntries(result) as Partial<T>;
};
