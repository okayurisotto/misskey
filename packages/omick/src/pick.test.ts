import { describe, expect, test } from "vitest";
import { pick, pickBy } from "./pick.js";

const data = {
  a: 1,
  b: 2,
  c: 3,
} as const;

describe("pick", () => {
  test("zero", () => {
    const result = pick(data, []);
    expect(result).toStrictEqual({});
  });

  test("one", () => {
    const result = pick(data, ["a"]);
    expect(result).toStrictEqual({ a: 1 });
  });

  test("two", () => {
    const result = pick(data, ["a", "b"]);
    expect(result).toStrictEqual({ a: 1, b: 2 });
  });
});

describe("pickBy", () => {
  test("false", () => {
    const result = pickBy(data, () => false);
    expect(result).toStrictEqual({});
  });

  test("true", () => {
    const result = pickBy(data, () => true);
    expect(result).toStrictEqual(data);
  });

  test("key", () => {
    const result = pickBy(data, ([key]) => ["a", "b"].includes(key));
    expect(result).toStrictEqual({ a: 1, b: 2 });
  });

  test("value", () => {
    const result = pickBy(data, ([, value]) => [1, 2].includes(value));
    expect(result).toStrictEqual({ a: 1, b: 2 });
  });
});
