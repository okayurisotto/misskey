import { z } from "zod";
import { Converter } from "./type.js";
export declare const ZodRecord: z.ZodObject<{
    typeName: z.ZodLiteral<"ZodRecord">;
    description: z.ZodOptional<z.ZodString>;
    keyType: z.ZodType<z.ZodType<any, z.ZodTypeDef, any>, z.ZodTypeDef, z.ZodType<any, z.ZodTypeDef, any>>;
    valueType: z.ZodType<z.ZodType<any, z.ZodTypeDef, any>, z.ZodTypeDef, z.ZodType<any, z.ZodTypeDef, any>>;
}, "strip", z.ZodTypeAny, {
    typeName?: "ZodRecord";
    description?: string;
    keyType?: z.ZodType<any, z.ZodTypeDef, any>;
    valueType?: z.ZodType<any, z.ZodTypeDef, any>;
}, {
    typeName?: "ZodRecord";
    description?: string;
    keyType?: z.ZodType<any, z.ZodTypeDef, any>;
    valueType?: z.ZodType<any, z.ZodTypeDef, any>;
}>;
export declare const convertZodRecord: Converter<typeof ZodRecord>;
