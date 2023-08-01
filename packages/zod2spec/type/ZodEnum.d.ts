import { z } from "zod";
import { Converter } from "./type.js";
export declare const ZodEnum: z.ZodObject<{
    typeName: z.ZodLiteral<"ZodEnum">;
    description: z.ZodOptional<z.ZodString>;
    values: z.ZodArray<z.ZodString, "many">;
}, "strip", z.ZodTypeAny, {
    typeName?: "ZodEnum";
    description?: string;
    values?: string[];
}, {
    typeName?: "ZodEnum";
    description?: string;
    values?: string[];
}>;
export declare const convertZodEnum: Converter<typeof ZodEnum>;
