import type { UnionToIntersection } from "type-fest";

type EntriesToObjectUnion<T extends [string, unknown]> = T extends unknown
  ? {
      [K in T[0]]: T[1];
    }
  : never;

export const fromEntries = <T extends [string, unknown][]>(data: [...T]) => {
  return Object.fromEntries(data) as UnionToIntersection<
    EntriesToObjectUnion<T[number]>
  >;
};
