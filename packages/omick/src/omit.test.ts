import { describe, expect, test } from "vitest";
import { omit, omitBy } from "./omit.js";

const data = {
  a: 1,
  b: 2,
  c: 3,
} as const;

describe("omit", () => {
  test("zero", () => {
    const result = omit(data, []);
    expect(result).toStrictEqual(data);
  });

  test("one", () => {
    const result = omit(data, ["a"]);
    expect(result).toStrictEqual({ b: 2, c: 3 });
  });

  test("two", () => {
    const result = omit(data, ["a", "b"]);
    expect(result).toStrictEqual({ c: 3 });
  });
});

describe("omitBy", () => {
  test("false", () => {
    const result = omitBy(data, () => false);
    expect(result).toStrictEqual(data);
  });

  test("true", () => {
    const result = omitBy(data, () => true);
    expect(result).toStrictEqual({});
  });

  test("key", () => {
    const result = omitBy(data, ([key]) => ["a", "b"].includes(key));
    expect(result).toStrictEqual({ c: 3 });
  });

  test("value", () => {
    const result = omitBy(data, ([, value]) => [1, 2].includes(value));
    expect(result).toStrictEqual({ c: 3 });
  });
});
