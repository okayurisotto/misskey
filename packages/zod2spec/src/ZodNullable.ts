import { z } from "zod";
import { Converter } from "./type.js";

export const ZodNullable = z.object({
  typeName: z.literal("ZodNullable"),
  description: z.string().optional(),
  innerType: z.custom<z.ZodType>(),
});

export const convertZodNullable: Converter<typeof ZodNullable> = (
  result,
  recursive,
) => {
  const inner = recursive(result.innerType);
  return {
    ...inner,
    nullable: true,
  };
};
