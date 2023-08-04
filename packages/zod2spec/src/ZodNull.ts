import { z } from "zod";
import { Converter } from "./type.js";

export const ZodNull = z.object({
  typeName: z.literal("ZodNull"),
  description: z.string().optional(),
});

export const convertZodNull: Converter<typeof ZodNull> = (result) => {
  return {
    type: "null",
    ...(result.description !== undefined
      ? { description: result.description }
      : {}),
  };
};
