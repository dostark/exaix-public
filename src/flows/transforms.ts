import { z } from "zod";

/**
 * Recursive JSON value type — covers every value that JSON.parse can produce.
 */
export type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };

/**
 * Zod schema for JsonValue to support recursive validation.
 */
export const JsonValueSchema: z.ZodType<JsonValue> = z.lazy(() =>
  z.union([
    z.string(),
    z.number(),
    z.boolean(),
    z.null(),
    z.array(JsonValueSchema),
    z.record(JsonValueSchema),
  ])
);

/**
 * Safely converts any value to a JsonValue by stripping undefined properties.
 * This is useful for passing complex types to the Activity Journal without using 'as unknown as'.
 */
export function toSafeJson(value: unknown): JsonValue {
  if (value === undefined || value === null) return null;

  if (Array.isArray(value)) {
    return value.map((item) => toSafeJson(item));
  }

  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    const result: { [key: string]: JsonValue } = {};
    for (const [key, val] of Object.entries(record)) {
      if (val !== undefined) {
        result[key] = toSafeJson(val);
      }
    }
    return result;
  }

  return value as JsonValue;
}

/**
 * Passthrough transform - returns input unchanged
 */
export function passthrough(input: string): string {
  return input;
}

/**
 * Merge multiple outputs as markdown sections
 * Creates a combined document with each input as a separate section
 */
export function mergeAsContext(inputs: string[]): string {
  if (inputs.length === 0) {
    return "";
  }

  return inputs
    .map((input, index) => `## Step ${index + 1}\n${input}`)
    .join("\n\n");
}

/**
 * Extract a specific markdown section from input
 * Finds content between ## SectionName and next ## or end of document
 */
export function extractSection(input: string, sectionName: string): string {
  const lines = input.split("\n");
  let inSection = false;
  const sectionContent: string[] = [];

  for (const line of lines) {
    if (line.startsWith("## ") && line.includes(sectionName)) {
      inSection = true;
      continue;
    }

    if (inSection && line.startsWith("## ")) {
      // Found next section, stop
      break;
    }

    if (inSection) {
      sectionContent.push(line);
    }
  }

  if (!inSection) {
    throw new Error(`Section '${sectionName}' not found`);
  }

  // Remove leading/trailing empty lines
  while (sectionContent.length > 0 && sectionContent[0].trim() === "") {
    sectionContent.shift();
  }
  while (sectionContent.length > 0 && sectionContent[sectionContent.length - 1].trim() === "") {
    sectionContent.pop();
  }

  return sectionContent.join("\n");
}

/**
 * Append original request to step output
 * Useful for maintaining context across steps
 */
export function appendToRequest(request: string, stepOutput: string): string {
  const requestPart = request ? `Original: ${request}` : "Original:";
  const outputPart = stepOutput ? `Step Output: ${stepOutput}` : "Step Output:";
  return `${requestPart}\n\n${outputPart}`;
}

/**
 * Extract field from JSON string using dot notation
 * Supports nested objects and arrays (e.g., "user.profile.age", "items.0.name")
 */
export function jsonExtract(input: string, fieldPath: string): JsonValue {
  let data: JsonValue;
  try {
    data = JSON.parse(input) as JsonValue;
  } catch (error) {
    throw new Error(`Invalid JSON input: ${(error as Error).message}`);
  }

  const path = fieldPath.split(".");
  let current: JsonValue = data;

  for (const segment of path) {
    if (current === null || current === undefined) {
      throw new Error(`Field '${fieldPath}' not found`);
    }

    // Handle array indices
    if (Array.isArray(current) && /^\d+$/.test(segment)) {
      const index = parseInt(segment, 10);
      if (index >= current.length) {
        throw new Error(`Field '${fieldPath}' not found`);
      }
      current = current[index];
    } else if (typeof current === "object" && !Array.isArray(current) && segment in current) {
      current = current[segment];
    } else {
      throw new Error(`Field '${fieldPath}' not found`);
    }
  }

  return current;
}

/**
 * Fill template with context variables
 * Replaces {{variable}} placeholders with values from context object
 */
export function templateFill(template: string, context: Record<string, JsonValue>): string {
  let result = template;

  // Find all {{variable}} patterns
  const variablePattern = /\{\{(\w+)\}\}/g;
  const variables: string[] = [];
  let match;

  while ((match = variablePattern.exec(template)) !== null) {
    const variable = match[1];
    if (!variables.includes(variable)) {
      variables.push(variable);
    }
  }

  // Replace each variable
  for (const variable of variables) {
    if (!(variable in context)) {
      throw new Error(`Missing context variable: ${variable}`);
    }
    const placeholder = `{{${variable}}}`;
    const rawValue = context[variable];
    const value = typeof rawValue === "object" ? JSON.stringify(rawValue) : String(rawValue);
    result = result.replace(new RegExp(placeholder.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g"), value);
  }

  return result;
}
