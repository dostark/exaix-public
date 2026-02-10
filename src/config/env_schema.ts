/**
 * Environment Variable Validation Schema (Phase 28, Phase 1)
 *
 * Provides Zod validation for EXO_LLM_* environment variable overrides.
 * These allow runtime override of AI provider configuration for CLI/TUI flexibility.
 *
 * Related: Phase 28 Environment Variable Cleanup and Validation
 */

import { z } from "zod";
import { ProviderType } from "../enums.ts";
import { ProviderTypeSchema } from "./ai_config.ts";
import { AI_TIMEOUT_MS_MAX, AI_TIMEOUT_MS_MIN, KNOWN_PROVIDERS } from "./constants.ts";

/**
 * Schema for EXO_LLM_* environment variable overrides
 * These allow runtime override of AI provider configuration
 */
export const EnvLLMOverrideSchema = z.object({
  EXO_LLM_PROVIDER: ProviderTypeSchema.optional(),
  EXO_LLM_MODEL: z.string().min(1).optional(),
  EXO_LLM_BASE_URL: z.string().url().optional(),
  EXO_LLM_TIMEOUT_MS: z.string()
    .regex(/^\d+$/)
    .transform(Number)
    .pipe(
      z.number()
        .min(AI_TIMEOUT_MS_MIN)
        .max(AI_TIMEOUT_MS_MAX),
    )
    .optional(),
});

export type EnvLLMOverride = z.infer<typeof EnvLLMOverrideSchema>;

/**
 * Helper to safely get and validate environment variables
 *
 * @returns Validated environment variable overrides (empty object if none set or all invalid)
 */
export function getValidatedEnvOverrides(): EnvLLMOverride {
  const raw = {
    EXO_LLM_PROVIDER: safeEnvGet("EXO_LLM_PROVIDER"),
    EXO_LLM_MODEL: safeEnvGet("EXO_LLM_MODEL"),
    EXO_LLM_BASE_URL: safeEnvGet("EXO_LLM_BASE_URL"),
    EXO_LLM_TIMEOUT_MS: safeEnvGet("EXO_LLM_TIMEOUT_MS"),
  };

  // Validate each field individually to handle partial failures
  const result: Partial<EnvLLMOverride> = {};

  // Validate provider
  if (raw.EXO_LLM_PROVIDER) {
    const providerResult = ProviderTypeSchema.safeParse(raw.EXO_LLM_PROVIDER);
    if (providerResult.success) {
      // Additional validation: check against known providers
      const normalized = raw.EXO_LLM_PROVIDER.toLowerCase().trim();
      if (KNOWN_PROVIDERS.includes(providerResult.data as ProviderType)) {
        result.EXO_LLM_PROVIDER = providerResult.data as ProviderType;
      } else {
        console.warn(`Invalid EXO_LLM_PROVIDER: "${raw.EXO_LLM_PROVIDER}" is not a known provider`);
      }
    }
  }

  // Validate model
  if (raw.EXO_LLM_MODEL) {
    const modelResult = z.string().min(1).safeParse(raw.EXO_LLM_MODEL);
    if (modelResult.success) {
      result.EXO_LLM_MODEL = modelResult.data;
    } else {
      console.warn(`Invalid EXO_LLM_MODEL: ${modelResult.error.message}`);
    }
  }

  // Validate base URL
  if (raw.EXO_LLM_BASE_URL) {
    const urlResult = z.string().url().safeParse(raw.EXO_LLM_BASE_URL);
    if (urlResult.success) {
      result.EXO_LLM_BASE_URL = urlResult.data;
    } else {
      console.warn(`Invalid EXO_LLM_BASE_URL: ${urlResult.error.message}`);
    }
  }

  // Validate timeout
  if (raw.EXO_LLM_TIMEOUT_MS) {
    const timeoutSchema = z.string()
      .regex(/^\d+$/)
      .transform(Number)
      .pipe(
        z.number()
          .min(AI_TIMEOUT_MS_MIN)
          .max(AI_TIMEOUT_MS_MAX),
      );
    const timeoutResult = timeoutSchema.safeParse(raw.EXO_LLM_TIMEOUT_MS);
    if (timeoutResult.success) {
      result.EXO_LLM_TIMEOUT_MS = timeoutResult.data;
    } else {
      console.warn(`Invalid EXO_LLM_TIMEOUT_MS: ${timeoutResult.error.message}`);
    }
  }

  return result as EnvLLMOverride;
}

/**
 * Safe environment getter that returns undefined when env access is not permitted
 *
 * @param key - Environment variable name
 * @returns Value or undefined if not set or access denied
 */
function safeEnvGet(key: string): string | undefined {
  try {
    return Deno.env.get(key);
  } catch {
    // Deno will throw NotCapable when env access is not allowed in the runtime.
    // Swallow that and return undefined so callers can fall back to defaults.
    return undefined;
  }
}

/**
 * Helper to check if a value represents a truthy boolean
 *
 * @param value - String value to check
 * @returns True if value represents a truthy boolean
 */
function isTruthyValue(value: string | undefined): boolean {
  if (!value) return false;
  const normalized = value.toLowerCase().trim();
  return normalized !== "0" && normalized !== "false" && normalized !== "no" && normalized !== "off";
}

/**
 * Check if code is running in test mode
 *
 * @returns True if EXO_TEST_MODE or EXO_TEST_CLI_MODE is set to a truthy value
 */
export function isTestMode(): boolean {
  // Check EXO_TEST_MODE first (general test mode)
  if (isTruthyValue(safeEnvGet("EXO_TEST_MODE"))) {
    return true;
  }

  // Also check EXO_TEST_CLI_MODE (CLI-specific test mode)
  return safeEnvGet("EXO_TEST_CLI_MODE") === "1";
}

/**
 * Check if code is running in CI mode
 * Checks both EXO_CI_MODE (preferred) and CI (standard) environment variables
 *
 * @returns True if EXO_CI_MODE or CI is set to a truthy value
 */
export function isCIMode(): boolean {
  // Prefer EXO_CI_MODE if set (more explicit)
  const exoCiMode = safeEnvGet("EXO_CI_MODE");
  if (exoCiMode !== undefined) {
    return isTruthyValue(exoCiMode);
  }

  // Fall back to standard CI env var
  return isTruthyValue(safeEnvGet("CI"));
}
