import { z } from "zod";
import { Converter } from "./type.js";
export declare const ZodNull: z.ZodObject<{
    typeName: z.ZodLiteral<"ZodNull">;
}, "strip", z.ZodTypeAny, {
    typeName?: "ZodNull";
}, {
    typeName?: "ZodNull";
}>;
export declare const convertZodNull: Converter<typeof ZodNull>;
