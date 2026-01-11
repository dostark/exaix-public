import { z } from "zod";

/**
 * Blueprint name validation - prevents path traversal and injection
 */
export const BlueprintNameSchema = z.string()
  .min(1, "Blueprint name cannot be empty")
  .max(100, "Blueprint name too long (max 100 chars)")
  .regex(/^[a-zA-Z0-9_-]+$/, "Blueprint name can only contain letters, numbers, hyphens, and underscores")
  .refine(
    (val) => !/\.\./.test(val),
    "Path traversal not allowed",
  )
  .refine(
    (val) =>
      !/[<>:"|?*]/.test(val) && !val.split("").some((char) => char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127),
    "Special characters and control characters not allowed",
  );

/**
 * Portal name validation - prevents injection attacks
 */
export const PortalNameSchema = z.string()
  .min(1, "Portal name cannot be empty")
  .max(50, "Portal name too long (max 50 chars)")
  .regex(/^[a-zA-Z0-9_-]+$/, "Portal name can only contain letters, numbers, hyphens, and underscores");

/**
 * Agent ID validation - prevents path traversal
 */
export const AgentIdSchema = z.string()
  .min(1, "Agent ID cannot be empty")
  .max(50, "Agent ID too long (max 50 chars)")
  .regex(/^[a-zA-Z0-9_-]+$/, "Agent ID can only contain letters, numbers, hyphens, and underscores")
  .refine(
    (val) => !/\.\./.test(val),
    "Path traversal not allowed",
  );

/**
 * Trace ID validation - ensures valid UUID format
 */
export const TraceIdSchema = z.string()
  .regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/, "Invalid trace ID format");

/**
 * User request content validation - prevents DoS and injection
 */
export const UserRequestSchema = z.string()
  .min(1, "Request cannot be empty")
  .max(10000, "Request too long (max 10KB)")
  .refine(
    (val) => !/<script[^>]*>.*?<\/script>/gis.test(val),
    "Script tags not allowed",
  )
  .refine(
    (val) => !/<iframe[^>]*>.*?<\/iframe>/gis.test(val),
    "Iframe tags not allowed",
  )
  .refine((val) => !/<img[^>]*>/gis.test(val), "Image tags not allowed")
  .refine(
    (val) => !val.split("").some((char) => char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127),
    "Control characters not allowed",
  );

/**
 * Plan content validation - prevents DoS and injection
 */
export const PlanSchema = z.string()
  .min(1, "Plan cannot be empty")
  .max(50000, "Plan too long (max 50KB)")
  .refine(
    (val) => !/<script[^>]*>.*?<\/script>/gis.test(val),
    "Script tags not allowed",
  )
  .refine(
    (val) => !val.split("").some((char) => char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127),
    "Control characters not allowed",
  );

/**
 * Security mode validation
 */
export const SecurityModeSchema = z.enum(["sandboxed", "hybrid"]);

/**
 * Model configuration validation - prevents prototype pollution
 */
export const ModelConfigSchema = z.object({
  provider: z.enum(["openai", "anthropic", "google", "ollama", "mock"]),
  model: z.string().min(1).max(100),
  temperature: z.number().min(0).max(2).optional(),
  max_tokens: z.number().int().min(1).max(100000).optional(),
  base_url: z.string().url().optional(),
  timeout_ms: z.number().int().min(1000).max(300000).optional(),
  mock: z.object({
    strategy: z.enum(["recorded", "scripted", "pattern", "failing", "slow"]),
    fixtures_dir: z.string().optional(),
    error_message: z.string().optional(),
    delay_ms: z.number().int().positive().optional(),
  }).optional(),
}).strict();

/**
 * Execution context validation
 */
export const ExecutionContextSchema = z.object({
  trace_id: TraceIdSchema,
  request_id: z.string().min(1).max(100),
  request: UserRequestSchema,
  plan: PlanSchema,
  portal: PortalNameSchema,
  step_number: z.number().int().positive().optional(),
  userId: z.string().optional(),
  sessionId: z.string().optional(),
  timestamp: z.date().optional(),
}).strict();

/**
 * Agent execution options validation
 */
export const AgentExecutionOptionsSchema = z.object({
  agent_id: BlueprintNameSchema,
  portal: PortalNameSchema,
  security_mode: z.enum(["sandboxed", "hybrid"]).default("sandboxed"),
  timeout_ms: z.number().int().positive().default(300000), // 5 minutes
  max_tool_calls: z.number().int().positive().default(100),
  audit_enabled: z.boolean().default(true),
}).strict();

/**
 * Input validation utility class
 */
export class InputValidator {
  /**
   * Validates execution context
   */
  static validateExecutionContext(rawContext: unknown): z.infer<typeof ExecutionContextSchema> {
    return ExecutionContextSchema.parse(rawContext);
  }

  /**
   * Validates agent execution options
   */
  static validateAgentExecutionOptions(rawOptions: unknown): z.infer<typeof AgentExecutionOptionsSchema> {
    return AgentExecutionOptionsSchema.parse(rawOptions);
  }

  /**
   * Validates blueprint name
   */
  static validateBlueprintName(rawName: unknown): z.infer<typeof BlueprintNameSchema> {
    return BlueprintNameSchema.parse(rawName);
  }

  /**
   * Validates model configuration
   */
  static validateModelConfig(rawConfig: unknown): z.infer<typeof ModelConfigSchema> {
    return ModelConfigSchema.parse(rawConfig);
  }
}

/**
 * Input sanitization utility class
 */
export class InputSanitizer {
  /**
   * Helper function to remove control characters from a string
   */
  private static removeControlChars(str: string): string {
    return str.split("").filter((char) => {
      const code = char.charCodeAt(0);
      return code >= 32 && code !== 127; // Keep printable chars, remove control chars and DEL
    }).join("");
  }

  /**
   * Sanitizes filename by removing dangerous characters
   */
  static sanitizeFilename(filename: string): string {
    return filename
      .replace(/[<>:"|?*\\/]/g, "_") // Replace dangerous chars with underscore
      .replace(/\.\./g, "_._") // Replace .. with _._
      .replace(/^\.+/, "") // Remove leading dots
      .replace(/\.+$/, "") // Remove trailing dots
      .substring(0, 255); // Limit length
  }

  /**
   * Sanitizes file path by preventing traversal
   */
  static sanitizePath(path: string): string {
    return path
      .replace(/\.\./g, "") // Remove parent directory references
      .replace(/[<>:"|?*]/g, "_") // Replace dangerous chars
      .replace(/^\/+/, "") // Remove leading slashes
      .replace(/\/+$/, "") // Remove trailing slashes
      .substring(0, 4096); // Limit path length
  }

  /**
   * Sanitizes user text input
   */
  static sanitizeUserText(text: string): string {
    return this.removeControlChars(text)
      .replace(/<script[^>]*>.*?<\/script>/gis, "[SCRIPT REMOVED]") // Remove script tags
      .replace(/<iframe[^>]*>.*?<\/iframe>/gis, "[IFRAME REMOVED]") // Remove iframe tags
      .substring(0, 10000); // Limit length
  }

  /**
   * Sanitizes plan text
   */
  static sanitizePlanText(text: string): string {
    return this.removeControlChars(text)
      .replace(/<script[^>]*>.*?<\/script>/gis, "[SCRIPT REMOVED]") // Remove script tags
      .substring(0, 50000); // Limit length
  }

  /**
   * Limits text length with truncation
   */
  static limitTextLength(text: string, maxLength: number): string {
    if (text.length <= maxLength) return text;

    return text.substring(0, maxLength - 3) + "...";
  }
}
