import { z } from "zod";
import { Converter } from "./type.js";
export declare const ZodEffects: z.ZodObject<{
    typeName: z.ZodLiteral<"ZodEffects">;
    schema: z.ZodType<z.ZodType<any, z.ZodTypeDef, any>, z.ZodTypeDef, z.ZodType<any, z.ZodTypeDef, any>>;
}, "strip", z.ZodTypeAny, {
    typeName?: "ZodEffects";
    schema?: z.ZodType<any, z.ZodTypeDef, any>;
}, {
    typeName?: "ZodEffects";
    schema?: z.ZodType<any, z.ZodTypeDef, any>;
}>;
export declare const convertZodEffects: Converter<typeof ZodEffects>;
