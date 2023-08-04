import { z } from "zod";
import { Converter } from "./type.js";

export const ZodUnknown = z.object({
  typeName: z.literal("ZodUnknown"),
  description: z.string().optional(),
});

export const convertZodUnknown: Converter<typeof ZodUnknown> = (result) => {
  return {
    ...(result.description !== undefined
      ? { description: result.description }
      : {}),
  };
};
