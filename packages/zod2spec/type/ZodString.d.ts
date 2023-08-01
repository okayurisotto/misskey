import { z } from "zod";
import { Converter } from "./type.js";
export declare const ZodString: z.ZodObject<{
    typeName: z.ZodLiteral<"ZodString">;
    description: z.ZodOptional<z.ZodString>;
    checks: z.ZodOptional<z.ZodArray<z.ZodUnion<[z.ZodObject<{
        kind: z.ZodLiteral<"min">;
        value: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        kind?: "min";
        value?: number;
    }, {
        kind?: "min";
        value?: number;
    }>, z.ZodObject<{
        kind: z.ZodLiteral<"max">;
        value: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        kind?: "max";
        value?: number;
    }, {
        kind?: "max";
        value?: number;
    }>, z.ZodObject<{
        kind: z.ZodLiteral<"regex">;
        regex: z.ZodType<RegExp, z.ZodTypeDef, RegExp>;
    }, "strip", z.ZodTypeAny, {
        kind?: "regex";
        regex?: RegExp;
    }, {
        kind?: "regex";
        regex?: RegExp;
    }>, z.ZodObject<{
        kind: z.ZodLiteral<"datetime">;
        precision: z.ZodUnknown;
        offset: z.ZodUnknown;
    }, "strip", z.ZodTypeAny, {
        kind?: "datetime";
        precision?: unknown;
        offset?: unknown;
    }, {
        kind?: "datetime";
        precision?: unknown;
        offset?: unknown;
    }>, z.ZodObject<{
        kind: z.ZodEnum<["email", "url"]>;
    }, "strip", z.ZodTypeAny, {
        kind?: "url" | "email";
    }, {
        kind?: "url" | "email";
    }>]>, "many">>;
}, "strip", z.ZodTypeAny, {
    typeName?: "ZodString";
    description?: string;
    checks?: ({
        kind?: "min";
        value?: number;
    } | {
        kind?: "max";
        value?: number;
    } | {
        kind?: "regex";
        regex?: RegExp;
    } | {
        kind?: "datetime";
        precision?: unknown;
        offset?: unknown;
    } | {
        kind?: "url" | "email";
    })[];
}, {
    typeName?: "ZodString";
    description?: string;
    checks?: ({
        kind?: "min";
        value?: number;
    } | {
        kind?: "max";
        value?: number;
    } | {
        kind?: "regex";
        regex?: RegExp;
    } | {
        kind?: "datetime";
        precision?: unknown;
        offset?: unknown;
    } | {
        kind?: "url" | "email";
    })[];
}>;
export declare const convertZodString: Converter<typeof ZodString>;
