import { z } from "zod";
import { Converter } from "./type.js";
export declare const ZodObject: z.ZodObject<{
    typeName: z.ZodLiteral<"ZodObject">;
    description: z.ZodOptional<z.ZodString>;
    unknownKeys: z.ZodEnum<["strip", "strict"]>;
    shape: z.ZodType<() => Record<string, z.ZodType>, z.ZodTypeDef, () => Record<string, z.ZodType>>;
}, "strip", z.ZodTypeAny, {
    typeName?: "ZodObject";
    description?: string;
    unknownKeys?: "strict" | "strip";
    shape?: () => Record<string, z.ZodType>;
}, {
    typeName?: "ZodObject";
    description?: string;
    unknownKeys?: "strict" | "strip";
    shape?: () => Record<string, z.ZodType>;
}>;
export declare const convertZodObject: Converter<typeof ZodObject>;
