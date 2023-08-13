import { z } from "zod";
import { Converter } from "./type.js";

export const ZodLiteral = z.object({
  typeName: z.literal("ZodLiteral"),
  value: z.unknown(),
  description: z.string().optional(),
});

export const convertZodLiteral: Converter<typeof ZodLiteral> = (result) => {
  return {
    ...(result.description !== undefined
      ? { description: result.description }
      : {}),
    enum: [result.value],
  };
};
