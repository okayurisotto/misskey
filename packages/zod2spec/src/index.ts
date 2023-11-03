import { z } from "zod";
import type { ReferenceObject, SchemaObject } from "openapi3-ts/oas30";
import { key } from "./const.js";
import { ZodAny, convertZodAny } from "./ZodAny.js";
import { ZodArray, convertZodArray } from "./ZodArray.js";
import { ZodBoolean, convertZodBoolean } from "./ZodBoolean.js";
import { ZodDefault, convertZodDefault } from "./ZodDefault.js";
import { ZodEffects, convertZodEffects } from "./ZodEffects.js";
import { ZodEnum, convertZodEnum } from "./ZodEnum.js";
import { ZodLazy, convertZodLazy } from "./ZodLazy.js";
import { ZodLiteral, convertZodLiteral } from "./ZodLiteral.js";
import { ZodNull, convertZodNull } from "./ZodNull.js";
import { ZodNullable, convertZodNullable } from "./ZodNullable.js";
import { ZodNumber, convertZodNumber } from "./ZodNumber.js";
import { ZodObject, convertZodObject } from "./ZodObject.js";
import { ZodOptional, convertZodOptional } from "./ZodOptional.js";
import { ZodRecord, convertZodRecord } from "./ZodRecord.js";
import { ZodString, convertZodString } from "./ZodString.js";
import { ZodUnion, convertZodUnion } from "./ZodUnion.js";
import { ZodUnknown, convertZodUnknown } from "./ZodUnknown.js";
import { OpenApiZod } from "./type.js";

export const defineOpenApiSpec = <T extends OpenApiZod>(
  schema: T,
  spec: SchemaObject | ReferenceObject,
): T => {
  schema[key] = spec;
  return schema;
};

const ZodType = z.discriminatedUnion("typeName", [
  ZodAny,
  ZodArray,
  ZodBoolean,
  ZodDefault,
  ZodEffects,
  ZodEnum,
  ZodLazy,
  ZodLiteral,
  ZodNull,
  ZodNullable,
  ZodNumber,
  ZodObject,
  ZodOptional,
  ZodRecord,
  ZodString,
  ZodUnion,
  ZodUnknown,
]);

export const generateOpenApiSpec = (
  components: { key: string; schema: OpenApiZod | z.ZodType }[],
) => {
  return (schema: OpenApiZod | z.ZodType): SchemaObject | ReferenceObject => {
    if (key in schema) {
      return schema[key];
    }

    const component = components.find((component) => {
      return component.schema === schema;
    });
    if (component !== undefined) {
      return { $ref: `#/components/schemas/${component.key}` };
    }

    const recursive = generateOpenApiSpec(components);
    const result = ZodType.safeParse(schema._def);

    if (!result.success) {
      throw new Error(JSON.stringify(schema));
    }

    switch (result.data.typeName) {
      case "ZodAny":
        return convertZodAny(result.data, recursive);
      case "ZodArray":
        return convertZodArray(result.data, recursive);
      case "ZodBoolean":
        return convertZodBoolean(result.data, recursive);
      case "ZodDefault":
        return convertZodDefault(result.data, recursive);
      case "ZodEffects":
        return convertZodEffects(result.data, recursive);
      case "ZodEnum":
        return convertZodEnum(result.data, recursive);
      case "ZodLazy":
        return convertZodLazy(result.data, recursive);
      case "ZodLiteral":
        return convertZodLiteral(result.data, recursive);
      case "ZodNull":
        return convertZodNull(result.data, recursive);
      case "ZodNullable":
        return convertZodNullable(result.data, recursive);
      case "ZodNumber":
        return convertZodNumber(result.data, recursive);
      case "ZodObject":
        return convertZodObject(result.data, recursive);
      case "ZodOptional":
        return convertZodOptional(result.data, recursive);
      case "ZodRecord":
        return convertZodRecord(result.data, recursive);
      case "ZodString":
        return convertZodString(result.data, recursive);
      case "ZodUnion":
        return convertZodUnion(result.data, recursive);
      case "ZodUnknown":
        return convertZodUnknown(result.data, recursive);
      default:
        return result.data satisfies never;
    }
  };
};
