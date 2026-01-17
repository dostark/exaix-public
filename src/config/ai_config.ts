/**
 * AI Configuration Schema
 *
 * Step 5.8: LLM Provider Selection Logic
 *
 * Defines the Zod schema for the [ai] section of exo.config.toml
 */

import { z } from "zod";
import { ProviderRegistry } from "../ai/provider_registry.ts";
import { MockStrategy, ProviderType } from "../enums.ts";
import {
  DEFAULT_AI_MODEL,
  DEFAULT_AI_RETRY_BACKOFF_BASE_MS,
  DEFAULT_AI_RETRY_MAX_ATTEMPTS,
  DEFAULT_AI_TEMPERATURE_MAX,
  DEFAULT_AI_TEMPERATURE_MIN,
  DEFAULT_AI_TIMEOUT_MS,
  DEFAULT_ANTHROPIC_API_VERSION,
  DEFAULT_ANTHROPIC_ENDPOINT,
  DEFAULT_ANTHROPIC_MODEL,
  DEFAULT_ANTHROPIC_RETRY_BACKOFF_MS,
  DEFAULT_ANTHROPIC_RETRY_MAX_ATTEMPTS,
  DEFAULT_GOOGLE_ENDPOINT,
  DEFAULT_GOOGLE_MODEL,
  DEFAULT_GOOGLE_RETRY_BACKOFF_MS,
  DEFAULT_GOOGLE_RETRY_MAX_ATTEMPTS,
  DEFAULT_MOCK_MODEL,
  DEFAULT_MOCK_STRATEGY,
  DEFAULT_OLLAMA_ENDPOINT,
  DEFAULT_OLLAMA_MODEL,
  DEFAULT_OLLAMA_RETRY_BACKOFF_MS,
  DEFAULT_OLLAMA_RETRY_MAX_ATTEMPTS,
  DEFAULT_OPENAI_ENDPOINT,
  DEFAULT_OPENAI_MODEL,
  DEFAULT_OPENAI_RETRY_BACKOFF_MS,
  DEFAULT_OPENAI_RETRY_MAX_ATTEMPTS,
} from "../config/constants.ts";

/**
 * Dynamic provider type schema - validates against registered providers
 * This replaces the hardcoded enum to make provider types configurable
 */
export const ProviderTypeSchema = z.string().min(1).refine(
  (_val) => {
    // For schema validation, allow any non-empty string
    // Runtime validation will check against registered providers when the provider is created
    return true;
  },
  {
    message: "Provider type must be a non-empty string",
  },
);

/**
 * Mock strategy types
 */
export const MockStrategySchema = z.nativeEnum(MockStrategy);

export type MockStrategyType = z.infer<typeof MockStrategySchema>;

/**
 * Mock-specific configuration
 */
export const MockConfigSchema = z.object({
  /** Mock strategy: recorded, scripted, pattern, failing, slow */
  strategy: MockStrategySchema.default(DEFAULT_MOCK_STRATEGY),
  /** Directory for recorded response fixtures */
  fixtures_dir: z.string().optional(),
  /** Error message for failing strategy */
  error_message: z.string().optional(),
  /** Delay in ms for slow strategy */
  delay_ms: z.number().positive().optional(),
}).default({
  strategy: DEFAULT_MOCK_STRATEGY,
});

export type MockConfig = z.infer<typeof MockConfigSchema>;

/**
 * AI configuration schema for [ai] section in exo.config.toml
 */
export const AiConfigSchema = z.object({
  /** Provider type: mock, ollama, anthropic, openai */
  provider: ProviderTypeSchema.default(ProviderType.MOCK),

  /** Model name (provider-specific) */
  model: z.string().default(DEFAULT_AI_MODEL),

  /** API endpoint URL (for ollama, custom endpoints). Empty string means use default. */
  base_url: z.string().refine(
    (val) => val === "" || z.string().url().safeParse(val).success,
    { message: "Invalid url" },
  ).optional(),

  /** Request timeout in milliseconds */
  timeout_ms: z.number().positive().default(DEFAULT_AI_TIMEOUT_MS),

  /** Max output tokens */
  max_tokens: z.number().positive().optional(),

  /** Sampling temperature (0.0 - 2.0) */
  temperature: z.number().min(DEFAULT_AI_TEMPERATURE_MIN).max(DEFAULT_AI_TEMPERATURE_MAX).optional(),

  /** Mock-specific configuration */
  mock: MockConfigSchema.optional(),
}).default({
  provider: ProviderType.MOCK,
  timeout_ms: DEFAULT_AI_TIMEOUT_MS,
});

export type AiConfig = z.infer<typeof AiConfigSchema>;

/**
 * Default AI configuration
 */
export const DEFAULT_AI_CONFIG: AiConfig = {
  provider: ProviderType.MOCK,
  model: DEFAULT_AI_MODEL,
  timeout_ms: DEFAULT_AI_TIMEOUT_MS,
};

/**
 * Default models for each provider - now registry-driven
 */
export function getDefaultModels(): Record<string, string> {
  // Initialize registry if needed
  if (ProviderRegistry.getSupportedProviders().length === 0) {
    import("../ai/provider_factory.ts").then(({ initializeRegistry }) => initializeRegistry());
  }

  const models: Record<string, string> = {};
  for (const providerType of ProviderRegistry.getSupportedProviders()) {
    models[providerType] = getDefaultModelForProvider(providerType);
  }
  return models;
}

/**
 * Get the default model for a specific provider type
 */
function getDefaultModelForProvider(providerType: string): string {
  // Provider-specific defaults using constants and enum values
  if (providerType === ProviderType.MOCK) return DEFAULT_MOCK_MODEL;
  if (providerType === ProviderType.OLLAMA) return DEFAULT_OLLAMA_MODEL;
  if (providerType === ProviderType.ANTHROPIC) return DEFAULT_ANTHROPIC_MODEL;
  if (providerType === ProviderType.OPENAI) return DEFAULT_OPENAI_MODEL;
  if (providerType === ProviderType.GOOGLE) return DEFAULT_GOOGLE_MODEL;

  // Fallback for unknown providers
  return `${providerType}-model`;
}

/**
 * Default API endpoints for each provider - now registry-driven
 */
export function getDefaultEndpoints(): Record<string, string> {
  // Initialize registry if needed
  if (ProviderRegistry.getSupportedProviders().length === 0) {
    import("../ai/provider_factory.ts").then(({ initializeRegistry }) => initializeRegistry());
  }

  const endpoints: Record<string, string> = {};
  for (const providerType of ProviderRegistry.getSupportedProviders()) {
    endpoints[providerType] = getDefaultEndpointForProvider(providerType);
  }
  return endpoints;
}

/**
 * Get the default endpoint for a specific provider type
 */
function getDefaultEndpointForProvider(providerType: string): string {
  // Provider-specific defaults using constants and enum values
  if (providerType === ProviderType.MOCK) return "";
  if (providerType === ProviderType.OLLAMA) return DEFAULT_OLLAMA_ENDPOINT;
  if (providerType === ProviderType.ANTHROPIC) return DEFAULT_ANTHROPIC_ENDPOINT;
  if (providerType === ProviderType.OPENAI) return DEFAULT_OPENAI_ENDPOINT;
  if (providerType === ProviderType.GOOGLE) return DEFAULT_GOOGLE_ENDPOINT;

  // Fallback for unknown providers
  return "";
}

/**
 * Default retry configuration per provider - now registry-driven
 */
export function getDefaultRetryConfig(): Record<string, { maxAttempts: number; backoffBaseMs: number }> {
  // Initialize registry if needed
  if (ProviderRegistry.getSupportedProviders().length === 0) {
    import("../ai/provider_factory.ts").then(({ initializeRegistry }) => initializeRegistry());
  }

  const retryConfig: Record<string, { maxAttempts: number; backoffBaseMs: number }> = {};
  for (const providerType of ProviderRegistry.getSupportedProviders()) {
    retryConfig[providerType] = getDefaultRetryConfigForProvider(providerType);
  }
  return retryConfig;
}

/**
 * Get the default retry config for a specific provider type
 */
function getDefaultRetryConfigForProvider(providerType: string): { maxAttempts: number; backoffBaseMs: number } {
  // Provider-specific defaults using constants and enum values
  if (providerType === ProviderType.MOCK) return { maxAttempts: 1, backoffBaseMs: 0 };
  if (providerType === ProviderType.OLLAMA) {
    return { maxAttempts: DEFAULT_OLLAMA_RETRY_MAX_ATTEMPTS, backoffBaseMs: DEFAULT_OLLAMA_RETRY_BACKOFF_MS };
  }
  if (providerType === ProviderType.ANTHROPIC) {
    return { maxAttempts: DEFAULT_ANTHROPIC_RETRY_MAX_ATTEMPTS, backoffBaseMs: DEFAULT_ANTHROPIC_RETRY_BACKOFF_MS };
  }
  if (providerType === ProviderType.OPENAI) {
    return { maxAttempts: DEFAULT_OPENAI_RETRY_MAX_ATTEMPTS, backoffBaseMs: DEFAULT_OPENAI_RETRY_BACKOFF_MS };
  }
  if (providerType === ProviderType.GOOGLE) {
    return { maxAttempts: DEFAULT_GOOGLE_RETRY_MAX_ATTEMPTS, backoffBaseMs: DEFAULT_GOOGLE_RETRY_BACKOFF_MS };
  }

  // Fallback for unknown providers
  return { maxAttempts: DEFAULT_AI_RETRY_MAX_ATTEMPTS, backoffBaseMs: DEFAULT_AI_RETRY_BACKOFF_BASE_MS };
}

/**
 * Anthropic API version header default
 */
export const ANTHROPIC_API_VERSION = DEFAULT_ANTHROPIC_API_VERSION;
