import { z } from "zod";
import { Converter } from "./type.js";

type Format = "email" | "url";
const formatMap = new Map<Format, string>([
  ["email", "email"],
  ["url", "url"],
]);

export const ZodString = z.object({
  typeName: z.literal("ZodString"),
  description: z.string().optional(),
  checks: z
    .array(
      z.union([
        z.object({
          kind: z.literal("min"),
          value: z.number().int().nonnegative(),
        }),
        z.object({
          kind: z.literal("max"),
          value: z.number().int().nonnegative(),
        }),
        z.object({
          kind: z.literal("length"),
          value: z.number().int().nonnegative(),
        }),
        z.object({
          kind: z.literal("regex"),
          regex: z.custom<RegExp>((v) => v instanceof RegExp),
        }),
        z.object({
          kind: z.literal("datetime"),
          precision: z.unknown(),
          offset: z.unknown(),
        }),
        z.object({
          kind: z.enum(["email", "url"] as const satisfies readonly Format[]),
        }),
      ]),
    )
    .optional(),
});

export const convertZodString: Converter<typeof ZodString> = (result) => {
  const min = result.checks?.find(
    (check): check is { kind: "min"; value: number } => {
      return check.kind === "min";
    },
  );

  const max = result.checks?.find(
    (check): check is { kind: "max"; value: number } => {
      return check.kind === "max";
    },
  );

  const length = result.checks?.find(
    (check): check is { kind: "length"; value: number } => {
      return check.kind === "length";
    },
  );

  const format = result.checks?.find(
    (check): check is { kind: "email" | "url" } => {
      if (check.kind === "email") return true;
      if (check.kind === "url") return true;
      return false;
    },
  );

  const regex = result.checks?.find(
    (check): check is { kind: "regex"; regex: RegExp } => {
      return check.kind === "regex";
    },
  );

  const datetime = result.checks?.find(
    (
      check,
    ): check is { kind: "datetime"; precision: unknown; offset: unknown } => {
      return check.kind === "datetime";
    },
  );

  return {
    type: "string",
    ...(result.description !== undefined
      ? { description: result.description }
      : {}),
    ...(datetime !== undefined ? { format: "date-time" } : {}),
    ...(format !== undefined ? { format: formatMap.get(format.kind)! } : {}),
    ...(max !== undefined ? { maxLength: max.value } : {}),
    ...(min !== undefined ? { minLength: min.value } : {}),
    ...(length !== undefined
      ? { maxLength: length.value, minLength: length.value }
      : {}),
    ...(regex !== undefined ? { pattern: regex.regex.source } : {}),
  };
};
