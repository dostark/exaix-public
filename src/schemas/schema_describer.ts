/**
 * @module SchemaDescriber
 * @path src/schemas/schema_describer.ts
 * @description Provides a utility function to generate human-readable descriptions from Zod schemas, aiding LLMs in resolving validation errors.
 * @architectural-layer Schemas
 * @dependencies [zod]
 * @related-files [src/services/request_processor.ts]
 */

import { ZodType, ZodTypeDef } from "zod";

/**
 * Generate a human-readable schema description from a Zod schema
 * Useful for providing context to LLMs for fixing validation errors.
 */
export function describeSchema<T>(
  schema: ZodType<T, ZodTypeDef, unknown>,
): string {
  // Get schema description from Zod's internal structure
  // Using unknown cast to safely access Zod internal structure
  const def = schema._def as unknown as Record<string, unknown>;

  if ("typeName" in def) {
    switch (def.typeName) {
      case "ZodObject": {
        const shapeFn = (def as unknown as { shape: () => Record<string, ZodType<unknown>> }).shape;
        if (typeof shapeFn === "function") {
          const shape = shapeFn();
          const fields = Object.entries(shape)
            .map(([key, val]) => `  "${key}": ${describeSchema(val)}`)
            .join(",\n");
          return `{\n${fields}\n}`;
        }
        return "object";
      }
      case "ZodArray": {
        const typeProp = (def as unknown as { type?: ZodType<unknown> }).type;
        if (typeProp) {
          return `Array<${describeSchema(typeProp)}>`;
        }
        return "Array<unknown>";
      }
      case "ZodString":
        return "string";
      case "ZodNumber":
        return "number";
      case "ZodBoolean":
        return "boolean";
      case "ZodEnum": {
        const values = (def as unknown as { values?: string[] }).values;
        if (values) {
          return `enum(${values.join(" | ")})`;
        }
        return "enum";
      }
      case "ZodOptional": {
        const innerType = (def as unknown as { innerType?: ZodType<unknown> }).innerType;
        if (innerType) {
          return `optional(${describeSchema(innerType)})`;
        }
        return "optional(unknown)";
      }
      case "ZodEffects": {
        const schemaProp = (def as unknown as { schema?: ZodType<unknown> }).schema;
        if (schemaProp) {
          return describeSchema(schemaProp);
        }
        return "refined(unknown)";
      }
      default:
        return "unknown";
    }
  }

  return "unknown";
}
