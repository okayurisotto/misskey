import { z } from "zod";
import { Converter } from "./type.js";
export declare const ZodAny: z.ZodObject<{
    typeName: z.ZodLiteral<"ZodAny">;
}, "strip", z.ZodTypeAny, {
    typeName?: "ZodAny";
}, {
    typeName?: "ZodAny";
}>;
export declare const convertZodAny: Converter<typeof ZodAny>;
