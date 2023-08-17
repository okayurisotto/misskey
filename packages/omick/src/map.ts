import { fromEntries, toEntries } from "./index.js";
import { isNotUndefined } from "./utils/isNotUndefined.js";
import { ObjectToEntryUnion } from "./utils/toEntries.js";

export const map = <
  T extends Record<string, unknown>,
  U extends [string, unknown],
>(
  data: T,
  fn: (entry: ObjectToEntryUnion<T>) => U | undefined,
) => {
  const entries = toEntries(data);
  const result = entries.map((entry) => fn(entry)).filter(isNotUndefined);
  return fromEntries(result);
};
