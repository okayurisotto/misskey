import { z } from "zod";
import { Converter } from "./type.js";

export const ZodAny = z.object({
  typeName: z.literal("ZodAny"),
});

export const convertZodAny: Converter<typeof ZodAny> = () => {
  return {};
};
