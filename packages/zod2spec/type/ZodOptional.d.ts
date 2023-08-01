import { z } from "zod";
import { Converter } from "./type.js";
export declare const ZodOptional: z.ZodObject<{
    typeName: z.ZodLiteral<"ZodOptional">;
    description: z.ZodOptional<z.ZodString>;
    innerType: z.ZodType<z.ZodType<any, z.ZodTypeDef, any>, z.ZodTypeDef, z.ZodType<any, z.ZodTypeDef, any>>;
}, "strip", z.ZodTypeAny, {
    typeName?: "ZodOptional";
    description?: string;
    innerType?: z.ZodType<any, z.ZodTypeDef, any>;
}, {
    typeName?: "ZodOptional";
    description?: string;
    innerType?: z.ZodType<any, z.ZodTypeDef, any>;
}>;
export declare const convertZodOptional: Converter<typeof ZodOptional>;
