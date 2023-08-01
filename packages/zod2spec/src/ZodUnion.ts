import { z } from "zod";
import { Converter } from "./type.js";

export const ZodUnion = z.object({
  typeName: z.literal("ZodUnion"),
  description: z.string().optional(),
  options: z.array(z.custom<z.ZodType>()),
});

export const convertZodUnion: Converter<typeof ZodUnion> = (result, recursive) => {
  return {
    anyOf: result.options.map((schema) => recursive(schema)),
    ...(result.description !== undefined
      ? { description: result.description }
      : {}),
  };
};
