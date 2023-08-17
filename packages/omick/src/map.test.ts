import { expect, test } from "vitest";
import { map } from "./map.js";

const data = {
  a: 1,
  b: 2,
  c: 3,
  d: { deep: true },
} as const;

test("none", () => {
  const result = map(data, (_) => _);
  expect(result).toStrictEqual(data);
});

test("key: map", () => {
  const result = map(data, ([key, value]) => [key.toUpperCase(), value]);
  expect(result).toStrictEqual({
    A: 1,
    B: 2,
    C: 3,
    D: { deep: true },
  });
});

test("key: overwrite", () => {
  const result = map(data, ([, value]) => ["_" as const, value]);
  expect(result).toStrictEqual({
    _: { deep: true },
  });
});

test("value: map", () => {
  const result = map(data, ([key, value]) => [key, JSON.stringify(value)]);
  expect(result).toStrictEqual({
    a: "1",
    b: "2",
    c: "3",
    d: JSON.stringify({ deep: true }),
  });
});
