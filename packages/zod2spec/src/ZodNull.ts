import { z } from "zod";
import { Converter } from "./type.js";

export const ZodNull = z.object({
  typeName: z.literal("ZodNull"),
});

export const convertZodNull: Converter<typeof ZodNull> = () => {
  return {
    type: "null",
  };
};
