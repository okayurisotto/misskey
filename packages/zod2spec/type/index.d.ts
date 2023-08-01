import type { ReferenceObject, SchemaObject } from "openapi3-ts/oas30";
import { key } from "./const.js";
import { OpenApiZod } from "./type.js";
export declare const defineOpenApiSpec: <T extends OpenApiZod>(schema: T, spec: SchemaObject | ReferenceObject) => T;
export declare const generateOpenApiSpec: (components: {
    key: string;
    schema: OpenApiZod;
}[]) => (schema: OpenApiZod) => SchemaObject | ReferenceObject;
