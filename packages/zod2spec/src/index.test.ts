import { z } from "zod";
import { describe, expect, test } from "vitest";
import { defineOpenApiSpec, generateOpenApiSpec } from "./index.js";
import type { ReferenceObject, SchemaObject } from "openapi3-ts/oas30";
import type { ReadonlyDeep } from "type-fest";

type Entries = ReadonlyDeep<[string, z.ZodType, SchemaObject][]>;

const entries = [
  // any
  ["any", z.any(), {}],
  // unknown
  ["unknown", z.unknown(), {}],
  // null
  ["null", z.null(), { type: "null" }],
  // boolean
  ["boolean", z.boolean(), { type: "boolean" }],
  // string
  ["string", z.string(), { type: "string" }],
  ["string[min]", z.string().min(10), { type: "string", minLength: 10 }],
  ["string[max]", z.string().max(10), { type: "string", maxLength: 10 }],
  [
    "string[pattern]",
    z.string().regex(/^\w+\s+\w+$/),
    { type: "string", pattern: /^\w+\s+\w+$/.source },
  ],
  [
    "string[datatime]",
    z.string().datetime(),
    { type: "string", format: "date-time" },
  ],
  ["string[email]", z.string().email(), { type: "string", format: "email" }],
  ["string[url]", z.string().url(), { type: "string", format: "url" }],
  // number
  ["number", z.number(), { type: "number" }],
  ["number[integer]", z.number().int(), { type: "integer" }],
  [
    "number[min]",
    z.number().min(10),
    { type: "number", minimum: 10, exclusiveMinimum: false },
  ],
  [
    "number[max]",
    z.number().max(10),
    { type: "number", maximum: 10, exclusiveMaximum: false },
  ],
  [
    "number[positive]",
    z.number().positive(),
    { type: "number", minimum: 0, exclusiveMinimum: true },
  ],
  [
    "number[negative]",
    z.number().negative(),
    { type: "number", maximum: 0, exclusiveMaximum: true },
  ],
  [
    "number[nonpositive]",
    z.number().nonpositive(),
    { type: "number", maximum: 0, exclusiveMaximum: false },
  ],
  [
    "number[nonnegative]",
    z.number().nonnegative(),
    { type: "number", minimum: 0, exclusiveMinimum: false },
  ],
  // array
  [
    "array > string",
    z.array(z.string()),
    { type: "array", items: { type: "string" } },
  ],
  [
    "array[min] > string",
    z.array(z.string()).min(10),
    { type: "array", minItems: 10, items: { type: "string" } },
  ],
  [
    "array[max] > string",
    z.array(z.string()).max(10),
    { type: "array", maxItems: 10, items: { type: "string" } },
  ],
  [
    "array[exactLength] > string",
    z.array(z.string()).length(10),
    { type: "array", minItems: 10, maxItems: 10, items: { type: "string" } },
  ],
  // object
  [
    "object",
    z.object({ foo: z.string(), bar: z.number() }),
    {
      type: "object",
      properties: { foo: { type: "string" }, bar: { type: "number" } },
      required: ["foo", "bar"],
      additionalProperties: true,
    },
  ],
  [
    "object[empty]",
    z.object({}),
    { type: "object", properties: {}, additionalProperties: true },
  ],
  [
    "object[optional]",
    z.object({ foo: z.string(), bar: z.number().optional() }),
    {
      type: "object",
      properties: { foo: { type: "string" }, bar: { type: "number" } },
      required: ["foo"],
      additionalProperties: true,
    },
  ],
  [
    "object[no required]",
    z.object({ foo: z.string().optional(), bar: z.number().optional() }),
    {
      type: "object",
      properties: { foo: { type: "string" }, bar: { type: "number" } },
      additionalProperties: true,
    },
  ],
  // enum
  [
    "enum > number | string",
    z.enum(["foo", "bar"]),
    { type: "string", enum: ["foo", "bar"] },
  ],
  // union
  [
    "union > number | string",
    z.union([z.number(), z.string()]),
    { anyOf: [{ type: "number" }, { type: "string" }] },
  ],
  // record
  [
    "record",
    z.record(z.string(), z.string()),
    { type: "object", additionalProperties: { type: "string" } },
  ],
] as const satisfies Entries;

describe("-", () => {
  test.each(entries)("%s", (_name, input, output) => {
    expect(generateOpenApiSpec([])(input)).toStrictEqual(output);
  });
});

describe("description", () => {
  test.each(entries)("%s", (_name, input, output) => {
    const description = "description";
    expect(generateOpenApiSpec([])(input.describe(description))).toStrictEqual({
      ...output,
      description,
    });
  });
});

describe("nullable", () => {
  test.each(entries)("%s", (_name, input, output) => {
    expect(generateOpenApiSpec([])(input.nullable())).toStrictEqual({
      ...output,
      nullable: true,
    });
  });
});

describe("refine", () => {
  test.each(entries)("%s", (_name, input, output) => {
    expect(generateOpenApiSpec([])(input.refine(() => true))).toStrictEqual(
      output,
    );
  });
});

describe("default", () => {
  const entries = [
    ["null", z.null().default(null), { type: "null", default: null }],
    ["boolean", z.boolean().default(true), { type: "boolean", default: true }],
    ["string", z.string().default("foo"), { type: "string", default: "foo" }],
    [
      "array",
      z.array(z.string()).default([]),
      { type: "array", items: { type: "string" }, default: [] },
    ],
    [
      "object",
      z.object({ foo: z.string().optional() }).default({}),
      {
        type: "object",
        properties: { foo: { type: "string" } },
        additionalProperties: true,
        default: {},
      },
    ],
    [
      "enum",
      z.enum(["foo", "bar"]).default("foo"),
      { type: "string", default: "foo", enum: ["foo", "bar"] },
    ],
  ] as const satisfies Entries;

  test.each(entries)("%s", (_name, input, output) => {
    expect(generateOpenApiSpec([])(input)).toStrictEqual(output);
  });
});

describe("lazy", () => {
  test("without defineOpenApiSpec", () => {
    const input = z.lazy(() => z.string());
    const output: SchemaObject = {};
    expect(generateOpenApiSpec([])(input)).toStrictEqual(output);
  });

  test("with defineOpenApiSpec", () => {
    const output: SchemaObject = { type: "string" };
    const input = defineOpenApiSpec(
      z.lazy(() => z.string()),
      output,
    );
    expect(generateOpenApiSpec([])(input)).toStrictEqual(output);
  });
});

describe("ref", () => {
  test("single component", () => {
    const key = "Sample";
    const component = z.string();

    const input = component;
    const output: ReferenceObject = { $ref: `#/components/schemas/${key}` };

    expect(
      generateOpenApiSpec([{ key, schema: component }])(input),
    ).toStrictEqual(output);
  });

  test("multiple components", () => {
    const keyA = "SampleA";
    const componentA = z.string();

    const keyB = "SampleB";
    const componentB = z.number();

    const input = z.union([componentA, componentB]);
    const output: SchemaObject = {
      anyOf: [
        { $ref: `#/components/schemas/${keyA}` },
        { $ref: `#/components/schemas/${keyB}` },
      ],
    };

    expect(
      generateOpenApiSpec([
        { key: keyA, schema: componentA },
        { key: keyB, schema: componentB },
      ])(input),
    ).toStrictEqual(output);
  });
});
