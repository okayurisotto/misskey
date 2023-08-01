import { z } from "zod";
import { Converter } from "./type.js";

export const ZodRecord = z.object({
  typeName: z.literal("ZodRecord"),
  description: z.string().optional(),
  keyType: z.custom<z.ZodType>(),
  valueType: z.custom<z.ZodType>(),
});

export const convertZodRecord: Converter<typeof ZodRecord> = (result, recursive) => {
  return {
    type: "object",
    ...(result.description !== undefined
      ? { description: result.description }
      : {}),
    additionalProperties: recursive(result.valueType),
  };
};
