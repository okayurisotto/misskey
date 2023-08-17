export type ObjectToEntryUnion<T> = {
  [K in keyof T]: K extends string ? [K, T[K]] : never;
}[keyof T];

export const toEntries = <T extends Record<string, unknown>>(data: T) => {
  return Object.entries(data) as ObjectToEntryUnion<T>[];
};
