import { z } from "zod";
import { ReferenceObject, SchemaObject } from "openapi3-ts/oas30";
import { key } from "./const.js";
export type OpenApiZod = z.ZodType & {
    [key]?: SchemaObject | ReferenceObject;
};
export type Converter<T extends OpenApiZod> = (result: z.infer<T>, recursive: (schema: OpenApiZod) => SchemaObject | ReferenceObject) => SchemaObject | ReferenceObject;
