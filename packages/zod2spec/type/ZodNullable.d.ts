import { z } from "zod";
import { Converter } from "./type.js";
export declare const ZodNullable: z.ZodObject<{
    typeName: z.ZodLiteral<"ZodNullable">;
    description: z.ZodOptional<z.ZodString>;
    innerType: z.ZodType<z.ZodType<any, z.ZodTypeDef, any>, z.ZodTypeDef, z.ZodType<any, z.ZodTypeDef, any>>;
}, "strip", z.ZodTypeAny, {
    typeName?: "ZodNullable";
    description?: string;
    innerType?: z.ZodType<any, z.ZodTypeDef, any>;
}, {
    typeName?: "ZodNullable";
    description?: string;
    innerType?: z.ZodType<any, z.ZodTypeDef, any>;
}>;
export declare const convertZodNullable: Converter<typeof ZodNullable>;
