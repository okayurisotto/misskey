import { z } from "zod";
import { Converter } from "./type.js";
export declare const ZodNumber: z.ZodObject<{
    typeName: z.ZodLiteral<"ZodNumber">;
    description: z.ZodOptional<z.ZodString>;
    checks: z.ZodOptional<z.ZodArray<z.ZodUnion<[z.ZodObject<{
        kind: z.ZodLiteral<"min">;
        value: z.ZodNumber;
        inclusive: z.ZodBoolean;
    }, "strip", z.ZodTypeAny, {
        kind?: "min";
        value?: number;
        inclusive?: boolean;
    }, {
        kind?: "min";
        value?: number;
        inclusive?: boolean;
    }>, z.ZodObject<{
        kind: z.ZodLiteral<"max">;
        value: z.ZodNumber;
        inclusive: z.ZodBoolean;
    }, "strip", z.ZodTypeAny, {
        kind?: "max";
        value?: number;
        inclusive?: boolean;
    }, {
        kind?: "max";
        value?: number;
        inclusive?: boolean;
    }>, z.ZodObject<{
        kind: z.ZodEnum<["int"]>;
    }, "strip", z.ZodTypeAny, {
        kind?: "int";
    }, {
        kind?: "int";
    }>]>, "many">>;
}, "strip", z.ZodTypeAny, {
    typeName?: "ZodNumber";
    description?: string;
    checks?: ({
        kind?: "min";
        value?: number;
        inclusive?: boolean;
    } | {
        kind?: "max";
        value?: number;
        inclusive?: boolean;
    } | {
        kind?: "int";
    })[];
}, {
    typeName?: "ZodNumber";
    description?: string;
    checks?: ({
        kind?: "min";
        value?: number;
        inclusive?: boolean;
    } | {
        kind?: "max";
        value?: number;
        inclusive?: boolean;
    } | {
        kind?: "int";
    })[];
}>;
export declare const convertZodNumber: Converter<typeof ZodNumber>;
