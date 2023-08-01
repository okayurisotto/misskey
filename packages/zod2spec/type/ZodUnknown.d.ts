import { z } from "zod";
import { Converter } from "./type.js";
export declare const ZodUnknown: z.ZodObject<{
    typeName: z.ZodLiteral<"ZodUnknown">;
}, "strip", z.ZodTypeAny, {
    typeName?: "ZodUnknown";
}, {
    typeName?: "ZodUnknown";
}>;
export declare const convertZodUnknown: Converter<typeof ZodUnknown>;
