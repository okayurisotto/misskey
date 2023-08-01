import { z } from "zod";
import { Converter } from "./type.js";
export declare const ZodLazy: z.ZodObject<{
    typeName: z.ZodLiteral<"ZodLazy">;
}, "strip", z.ZodTypeAny, {
    typeName?: "ZodLazy";
}, {
    typeName?: "ZodLazy";
}>;
export declare const convertZodLazy: Converter<typeof ZodLazy>;
