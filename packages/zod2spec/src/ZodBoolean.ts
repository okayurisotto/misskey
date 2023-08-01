import { z } from "zod";
import { Converter } from "./type.js";

export const ZodBoolean = z.object({
  typeName: z.literal("ZodBoolean"),
  description: z.string().optional(),
});

export const convertZodBoolean: Converter<typeof ZodBoolean> = () => {
  return { type: "boolean" };
};
