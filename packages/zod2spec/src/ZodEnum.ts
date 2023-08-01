import { z } from "zod";
import { Converter } from "./type.js";

export const ZodEnum = z.object({
  typeName: z.literal("ZodEnum"),
  description: z.string().optional(),
  values: z.array(z.string()),
});

export const convertZodEnum: Converter<typeof ZodEnum> = (result) => {
  return {
    type: "string",
    enum: result.values,
    ...(result.description !== undefined
      ? { description: result.description }
      : {}),
  };
};
