import { z } from "zod";
import { Converter } from "./type.js";
export declare const ZodArray: z.ZodObject<{
    typeName: z.ZodLiteral<"ZodArray">;
    description: z.ZodOptional<z.ZodString>;
    minLength: z.ZodNullable<z.ZodObject<{
        value: z.ZodNullable<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        value?: number;
    }, {
        value?: number;
    }>>;
    maxLength: z.ZodNullable<z.ZodObject<{
        value: z.ZodNullable<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        value?: number;
    }, {
        value?: number;
    }>>;
    exactLength: z.ZodUnknown;
    type: z.ZodType<z.ZodType<any, z.ZodTypeDef, any>, z.ZodTypeDef, z.ZodType<any, z.ZodTypeDef, any>>;
}, "strip", z.ZodTypeAny, {
    typeName?: "ZodArray";
    description?: string;
    minLength?: {
        value?: number;
    };
    maxLength?: {
        value?: number;
    };
    exactLength?: unknown;
    type?: z.ZodType<any, z.ZodTypeDef, any>;
}, {
    typeName?: "ZodArray";
    description?: string;
    minLength?: {
        value?: number;
    };
    maxLength?: {
        value?: number;
    };
    exactLength?: unknown;
    type?: z.ZodType<any, z.ZodTypeDef, any>;
}>;
export declare const convertZodArray: Converter<typeof ZodArray>;
