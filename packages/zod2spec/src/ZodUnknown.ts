import { z } from "zod";
import { Converter } from "./type.js";

export const ZodUnknown = z.object({
  typeName: z.literal("ZodUnknown"),
});

export const convertZodUnknown: Converter<typeof ZodUnknown> = () => {
  return {};
};
