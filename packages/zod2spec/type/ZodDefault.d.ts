import { z } from "zod";
import { Converter } from "./type.js";
export declare const ZodDefault: z.ZodObject<{
    typeName: z.ZodLiteral<"ZodDefault">;
    description: z.ZodOptional<z.ZodString>;
    defaultValue: z.ZodType<() => unknown, z.ZodTypeDef, () => unknown>;
    innerType: z.ZodType<z.ZodType<any, z.ZodTypeDef, any>, z.ZodTypeDef, z.ZodType<any, z.ZodTypeDef, any>>;
}, "strip", z.ZodTypeAny, {
    typeName?: "ZodDefault";
    description?: string;
    defaultValue?: () => unknown;
    innerType?: z.ZodType<any, z.ZodTypeDef, any>;
}, {
    typeName?: "ZodDefault";
    description?: string;
    defaultValue?: () => unknown;
    innerType?: z.ZodType<any, z.ZodTypeDef, any>;
}>;
export declare const convertZodDefault: Converter<typeof ZodDefault>;
