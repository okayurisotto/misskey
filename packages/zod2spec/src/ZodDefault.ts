import { z } from "zod";
import { Converter } from "./type.js";

export const ZodDefault = z.object({
  typeName: z.literal("ZodDefault"),
  description: z.string().optional(),
  defaultValue: z.custom<() => unknown>(),
  innerType: z.custom<z.ZodType>(),
});

export const convertZodDefault: Converter<typeof ZodDefault> = (
  result,
  recursive,
) => {
  const inner = recursive(result.innerType);
  return {
    ...inner,
    default: result.defaultValue(),
  };
};
