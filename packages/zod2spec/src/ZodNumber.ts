import { z } from "zod";
import { Converter } from "./type.js";

export const ZodNumber = z.object({
  typeName: z.literal("ZodNumber"),
  description: z.string().optional(),
  checks: z
    .array(
      z.union([
        z.object({
          kind: z.literal("min"),
          value: z.number().int().nonnegative(),
          inclusive: z.boolean(),
        }),
        z.object({
          kind: z.literal("max"),
          value: z.number().int().nonnegative(),
          inclusive: z.boolean(),
        }),
        z.object({
          kind: z.enum(["int"]),
        }),
      ]),
    )
    .optional(),
});

export const convertZodNumber: Converter<typeof ZodNumber> = (result) => {
  const isInt = result.checks?.some(({ kind }) => kind === "int") ?? false;

  const min = result.checks?.find(
    (check): check is { kind: "min"; value: number; inclusive: boolean } => {
      return check.kind === "min";
    },
  );

  const max = result.checks?.find(
    (check): check is { kind: "max"; value: number; inclusive: boolean } => {
      return check.kind === "max";
    },
  );

  return {
    type: isInt ? "integer" : "number",
    ...(result.description !== undefined
      ? { description: result.description }
      : {}),
    ...(min !== undefined
      ? { minimum: min.value, exclusiveMinimum: !min.inclusive }
      : {}),
    ...(max !== undefined
      ? { maximum: max.value, exclusiveMaximum: !max.inclusive }
      : {}),
  };
};
