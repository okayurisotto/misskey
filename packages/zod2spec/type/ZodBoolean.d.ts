import { z } from "zod";
import { Converter } from "./type.js";
export declare const ZodBoolean: z.ZodObject<{
    typeName: z.ZodLiteral<"ZodBoolean">;
    description: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    typeName?: "ZodBoolean";
    description?: string;
}, {
    typeName?: "ZodBoolean";
    description?: string;
}>;
export declare const convertZodBoolean: Converter<typeof ZodBoolean>;
