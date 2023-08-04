import { z } from "zod";
import { Converter } from "./type.js";

export const ZodArray = z.object({
  typeName: z.literal("ZodArray"),
  description: z.string().optional(),
  minLength: z
    .object({ value: z.number().int().nonnegative().nullable() })
    .nullable(),
  maxLength: z
    .object({ value: z.number().int().nonnegative().nullable() })
    .nullable(),
  exactLength: z
    .object({ value: z.number().int().nonnegative().nullable() })
    .nullable(),
  type: z.custom<z.ZodType>(),
});

export const convertZodArray: Converter<typeof ZodArray> = (
  result,
  recursive,
) => {
  return {
    type: "array",
    ...(result.description !== undefined
      ? { description: result.description }
      : {}),
    items: recursive(result.type),
    ...(result.minLength?.value != null
      ? { minItems: result.minLength.value }
      : {}),
    ...(result.maxLength?.value != null
      ? { maxItems: result.maxLength.value }
      : {}),
    ...(result.exactLength?.value != null
      ? {
          minItems: result.exactLength.value,
          maxItems: result.exactLength.value,
        }
      : {}),
  };
};
