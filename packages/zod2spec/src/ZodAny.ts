import { z } from "zod";
import { Converter } from "./type.js";

export const ZodAny = z.object({
  typeName: z.literal("ZodAny"),
  description: z.string().optional(),
});

export const convertZodAny: Converter<typeof ZodAny> = (result) => {
  return {
    ...(result.description !== undefined
      ? { description: result.description }
      : {}),
  };
};
