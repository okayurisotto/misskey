import { z } from "zod";
import { Converter } from "./type.js";

export const ZodObject = z.object({
  typeName: z.literal("ZodObject"),
  description: z.string().optional(),
  unknownKeys: z.enum(["strip", "strict"]),
  shape: z.custom<() => Record<string, z.ZodType>>(),
});

export const convertZodObject: Converter<typeof ZodObject> = (
  result,
  recursive,
) => {
  const required = Object.entries(result.shape())
    .filter(([, v]) => !v.isOptional())
    .map(([k]) => k);

  return {
    type: "object",
    ...(result.description !== undefined
      ? { description: result.description }
      : {}),
    properties: Object.fromEntries(
      Object.entries(result.shape()).map(([k, v]) => [k, recursive(v)]),
    ),
    ...(required.length > 1 ? { required } : {}),
    additionalProperties:
      result.unknownKeys === "strict"
        ? false
        : result.unknownKeys === "strip"
        ? true
        : (result.unknownKeys satisfies never),
  };
};
