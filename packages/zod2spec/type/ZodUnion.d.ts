import { z } from "zod";
import { Converter } from "./type.js";
export declare const ZodUnion: z.ZodObject<{
    typeName: z.ZodLiteral<"ZodUnion">;
    description: z.ZodOptional<z.ZodString>;
    options: z.ZodArray<z.ZodType<z.ZodType<any, z.ZodTypeDef, any>, z.ZodTypeDef, z.ZodType<any, z.ZodTypeDef, any>>, "many">;
}, "strip", z.ZodTypeAny, {
    typeName?: "ZodUnion";
    description?: string;
    options?: z.ZodType<any, z.ZodTypeDef, any>[];
}, {
    typeName?: "ZodUnion";
    description?: string;
    options?: z.ZodType<any, z.ZodTypeDef, any>[];
}>;
export declare const convertZodUnion: Converter<typeof ZodUnion>;
