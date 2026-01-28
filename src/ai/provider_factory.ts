/**
 * ProviderFactory - LLM Provider Selection Logic
 *
 * Creates the appropriate LLM provider based on:
 * 1. Environment variables (highest priority)
 * 2. Config file [ai] section (medium priority)
 * 3. Defaults (lowest priority) - MockLLMProvider for safety
 */
// @ts-ignore: Deno is a global in the Deno runtime
declare const Deno: any;

import * as DEFAULTS from "../config/constants.ts";
import { Config } from "../config/schema.ts";
import { AiConfig, getDefaultModels } from "../config/ai_config.ts";
import { MockStrategy, ProviderType } from "../enums.ts";
import { LlamaProvider } from "./providers/llama_provider.ts";
import { InputValidator } from "../schemas/input_validation.ts";
import { CostTracker } from "../services/cost_tracker.ts";
import { DatabaseService } from "../services/db.ts";
import { createAPIRetryPolicy, RetryPolicy } from "../services/retry_policy.ts";
import {
  AnthropicProviderFactory,
  GoogleProviderFactory,
  MockProviderFactory,
  OllamaProviderFactory,
  OpenAIProviderFactory,
  ProviderMetadata,
  ProviderRegistry,
} from "./provider_registry.ts";
import { RateLimitedProvider } from "./rate_limited_provider.ts";
import { PricingTier } from "../enums.ts";
import { IModelProvider, ProviderInfo, ResolvedProviderOptions } from "./types.ts";
export type { IModelProvider, ProviderInfo, ResolvedProviderOptions };
import { ProviderFactoryError } from "./errors.ts";
import { LazyProvider } from "./providers/lazy_provider.ts";

// ============================================================================
// ProviderFactory Implementation
// ============================================================================

/**
 * Factory for creating LLM providers based on environment and configuration.
 * Provides static methods for provider instantiation and info.
 */
export class ProviderFactory {
  /**
   * Create an LLM provider using a fallback chain.
   * Tries primary, then fallbacks, with optional health check and retry logic.
   *
   * @param config - ExoFrame configuration
   * @param fallback - Fallback chain config
   * @param db - Optional database service for cost tracking
   * @returns An IModelProvider instance
   */
  static async createWithFallback(
    config: Config,
    fallback: {
      primary: string;
      fallbacks: string[];
      maxRetries?: number;
      healthCheck?: boolean;
    },
    db?: DatabaseService,
  ): Promise<IModelProvider> {
    const chain = [fallback.primary, ...fallback.fallbacks];
    let lastError: unknown = undefined;

    for (const providerName of chain) {
      try {
        // Create retry policy for this provider attempt
        const retryPolicy = fallback.maxRetries !== undefined
          ? new RetryPolicy({ maxRetries: fallback.maxRetries })
          : createAPIRetryPolicy();

        // Use retry policy to create the provider
        const retryResult = await retryPolicy.execute(async () => {
          return await this.createByName(config, providerName, db);
        });

        if (!retryResult.success) {
          throw retryResult.error || new Error("Provider creation failed after retries");
        }

        const provider = retryResult.value!; // We know it's defined since success is true

        // Optional health check before returning
        if (fallback.healthCheck) {
          await validateProviderConnection(provider);
        }

        return provider;
      } catch (error) {
        lastError = error;
        // Use repo logging convention if available
        if (typeof console !== "undefined" && typeof console.warn === "function") {
          console.warn(`Provider ${providerName} failed after retries, trying next in chain`, error);
        }
        continue;
      }
    }

    throw new ProviderFactoryError(
      "All providers in fallback chain failed" + (lastError ? ": " + String(lastError) : ""),
    );
  }

  /**
   * Create an LLM provider by looking up a named fallback chain in configuration.
   *
   * @param config - ExoFrame configuration
   * @param chainName - Name of the fallback chain to use (e.g., "balanced", "fast")
   * @param db - Optional database service for cost tracking
   * @returns An IModelProvider instance
   */
  static async createByChainName(
    config: Config,
    chainName: string,
    db?: DatabaseService,
  ): Promise<IModelProvider> {
    const chain = config.provider_strategy?.fallback_chains?.[chainName];

    if (!chain || chain.length === 0) {
      throw new ProviderFactoryError(`Fallback chain '${chainName}' not found in configuration`);
    }

    const primary = chain[0];
    const fallbacks = chain.slice(1);

    // AI retry config for fallback attempts
    const maxRetries = config.ai_retry?.max_attempts;

    return await this.createWithFallback(config, {
      primary,
      fallbacks,
      maxRetries,
      healthCheck: config.provider_strategy?.health_check_enabled,
    }, db);
  }
  /**
   * Create an LLM provider based on environment and configuration.
   *
   * Priority order:
   * 1. Environment variables (EXO_LLM_PROVIDER, EXO_LLM_MODEL, etc.)
   * 2. Config file [ai] section
   * 3. Defaults (MockLLMProvider)
   *
   * @param config - ExoFrame configuration
   * @param db - Optional database service for cost tracking
   * @returns An IModelProvider instance
   */
  static async create(config: Config, db?: DatabaseService): Promise<IModelProvider> {
    const options = this.resolveOptions(config);
    const provider = await this.createProvider(options);

    // Apply rate limiting if enabled
    if (config.rate_limiting?.enabled) {
      const costTracker = db ? new CostTracker(db, config) : undefined;
      return new RateLimitedProvider(provider, {
        maxCallsPerMinute: config.rate_limiting.max_calls_per_minute,
        maxTokensPerHour: config.rate_limiting.max_tokens_per_hour,
        maxCostPerDay: config.rate_limiting.max_cost_per_day,
        costPer1kTokens: config.rate_limiting.cost_per_1k_tokens,
        costTracker,
      });
    }

    return provider;
  }

  /**
   * Create an LLM provider by name from the models configuration.
   *
   * @param config - ExoFrame configuration
   * @param name - Name of the model configuration (e.g., "default", "fast")
   * @param db - Optional database service for cost tracking
   * @returns An IModelProvider instance
   */
  static async createByName(config: Config, name: string, db?: DatabaseService): Promise<IModelProvider> {
    // Check if name refers to a fallback chain
    if (config.provider_strategy?.fallback_enabled && config.provider_strategy?.fallback_chains?.[name]) {
      return await this.createByChainName(config, name, db);
    }

    const options = this.resolveOptionsByName(config, name);
    const provider = await this.createProvider(options);

    // Apply rate limiting if enabled
    if (config.rate_limiting?.enabled) {
      const costTracker = db ? new CostTracker(db, config) : undefined;
      return new RateLimitedProvider(provider, {
        maxCallsPerMinute: config.rate_limiting.max_calls_per_minute,
        maxTokensPerHour: config.rate_limiting.max_tokens_per_hour,
        maxCostPerDay: config.rate_limiting.max_cost_per_day,
        costPer1kTokens: config.rate_limiting.cost_per_1k_tokens,
        costTracker,
      });
    }

    return provider;
  }

  /**
   * Get information about what provider would be created
   *
   * @param config - ExoFrame configuration
   * @returns Provider information for logging
   */
  static getProviderInfo(config: Config): ProviderInfo {
    const options = this.resolveOptions(config);
    const source = this.determineSource();
    return {
      type: options.provider,
      id: this.generateProviderId(options),
      model: options.model,
      source,
    };
  }

  /**
   * Get information about what provider would be created by name
   *
   * @param config - ExoFrame configuration
   * @param name - Name of the model configuration
   * @returns Provider information for logging
   */
  static getProviderInfoByName(config: Config, name: string): ProviderInfo {
    const options = this.resolveOptionsByName(config, name);
    const source = this.determineSource();
    return {
      type: options.provider,
      id: this.generateProviderId(options),
      model: options.model,
      source,
    };
  }

  /**
   * Resolve provider options from environment and config.
   * Accepts a model-level config (may have optional fields) and merges
   * env vars, modelConfig, and global config to produce a fully populated
   * ResolvedProviderOptions (guarantees timeoutMs).
   */
  private static resolveOptions(
    config: Config,
    rawModelConfig?: unknown,
  ): ResolvedProviderOptions {
    // ✓ Validate model config to prevent type confusion attacks
    const modelConfig = rawModelConfig ? InputValidator.validateModelConfig(rawModelConfig) : undefined;
    const envProvider = this.safeEnvGet("EXO_LLM_PROVIDER");
    const envModel = this.safeEnvGet("EXO_LLM_MODEL");
    const envBaseUrl = this.safeEnvGet("EXO_LLM_BASE_URL");
    const envTimeout = this.safeEnvGet("EXO_LLM_TIMEOUT_MS");

    // Base ai config from global config or sensible defaults
    const baseAi: AiConfig = (config.ai as AiConfig) ?? {
      provider: ProviderType.MOCK,
      timeout_ms: DEFAULTS.DEFAULT_AI_TIMEOUT_MS,
    };

    // Merge model-level config (may be from config.models[name]) on top of baseAi
    const merged: Partial<AiConfig> = {
      ...baseAi,
      ...(modelConfig ?? {}),
    };

    // Resolve provider type (env > modelConfig > global)
    let providerType: ProviderType = ProviderType.MOCK;
    if (envProvider) {
      const normalized = envProvider.toLowerCase().trim();
      // Initialize registry if needed
      if (ProviderRegistry.getSupportedProviders().length === 0) {
        initializeRegistry();
      }
      if (ProviderRegistry.getSupportedProviders().includes(normalized)) {
        providerType = normalized as ProviderType;
      } else {
        console.warn(`Unknown provider '${envProvider}' from EXO_LLM_PROVIDER, falling back to mock`);
        providerType = ProviderType.MOCK;
      }
    } else if (merged.provider) {
      // Initialize registry if needed for validation
      if (ProviderRegistry.getSupportedProviders().length === 0) {
        initializeRegistry();
      }
      if (ProviderRegistry.getSupportedProviders().includes(merged.provider)) {
        providerType = merged.provider as ProviderType;
      } else {
        console.warn(`Unknown provider '${merged.provider}' from config, falling back to mock`);
        providerType = ProviderType.MOCK;
      }
    }

    // Resolve model (env > merged.model > default per provider)
    const model = envModel ?? (merged.model ?? getDefaultModels()[providerType]);

    // Resolve base url and timeout (env > merged > defaults)
    const baseUrl = envBaseUrl ?? merged.base_url;

    // Resolve timeout with provider-specific fallback from ai_timeout config
    let timeoutMs = DEFAULTS.DEFAULT_AI_TIMEOUT_MS;
    if (envTimeout) {
      timeoutMs = parseInt(envTimeout, 10);
    } else if (merged.timeout_ms) {
      timeoutMs = merged.timeout_ms;
    } else if (config.ai_timeout && providerType !== "mock") {
      const providerTimeout = config.ai_timeout.providers?.[providerType];
      if (providerTimeout) {
        timeoutMs = providerTimeout;
      }
    }

    // Mock-specific
    const mockStrategy = merged.mock?.strategy ?? baseAi?.mock?.strategy ?? DEFAULTS.DEFAULT_MOCK_STRATEGY;
    const mockFixturesDir = merged.mock?.fixtures_dir ?? baseAi?.mock?.fixtures_dir;

    return {
      provider: providerType,
      model,
      baseUrl,
      timeoutMs,
      mockStrategy: mockStrategy as MockStrategy,
      mockFixturesDir,
    };
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  /**
   * Resolve provider options by name
   */
  private static resolveOptionsByName(config: Config, name: string): ResolvedProviderOptions {
    const modelConfig = config.models?.[name] ?? config.models?.["default"] ?? config.ai;
    return this.resolveOptions(config, modelConfig);
  }

  /**
   * Determine the source of configuration
   */
  private static determineSource(): "env" | "config" | "default" {
    if (this.safeEnvGet("EXO_LLM_PROVIDER")) {
      return "env";
    }
    // Note: We can't easily tell if config was set, so default to "config" if not env
    return "config";
  }

  /**
   * Create the appropriate provider based on resolved options
   */
  private static async createProvider(options: ResolvedProviderOptions): Promise<IModelProvider> {
    // Ensure registry is initialized
    initializeRegistry();

    // Try registry first for modern providers
    const factory = ProviderRegistry.getFactory(options.provider);
    if (factory) {
      // Use LazyProvider to defer initialization until first use
      return new LazyProvider(factory, options);
    }

    // Fall back to legacy direct instantiation for backward compatibility
    return await this.createProviderLegacy(options);
  }

  /**
   * Legacy provider creation for backward compatibility
   * TODO: Deprecate this method once all providers are migrated to registry
   */
  private static async createProviderLegacy(options: ResolvedProviderOptions): Promise<IModelProvider> {
    // Llama/Ollama model routing (special case for llama models)
    if (DEFAULTS.MODEL_ROUTING_LLAMA_PATTERN.test(options.model)) {
      return await new LlamaProvider({ model: options.model, endpoint: options.baseUrl });
    }

    // For any other provider, this fallback should not be reached since all providers
    // are now registered in the registry. If we reach here, it's an error.
    throw new ProviderFactoryError(
      `Provider '${options.provider}' is not registered in the provider registry. ` +
        `Available providers: ${ProviderRegistry.getSupportedProviders().join(", ")}`,
    );
  }

  /**
   * Generate a unique provider ID
   */
  private static generateProviderId(options: ResolvedProviderOptions): string {
    // Special case for mock provider which includes strategy
    if (options.provider === DEFAULTS.PROVIDER_MOCK) {
      return `${DEFAULTS.PROVIDER_ID_MOCK_PREFIX}${
        options.mockStrategy ?? DEFAULTS.PROVIDER_ID_MOCK_DEFAULT_STRATEGY
      }-${options.model}`;
    }

    // Default pattern for all other providers
    return `${options.provider}-${options.model}`;
  }

  /**
   * Safe environment getter that returns undefined when env access is not permitted
   */
  private static safeEnvGet(key: string): string | undefined {
    try {
      return Deno.env.get(key);
    } catch (_err) {
      // Deno will throw NotCapable when env access is not allowed in the runtime.
      // Swallow that and return undefined so callers can fall back to defaults.
      return undefined;
    }
  }
}

// ============================================================================
// Registry Initialization
// ============================================================================

/**
 * Initialize default provider factories in registry with metadata (lazy initialization)
 */
export function initializeRegistry(): void {
  // Only initialize if not already done
  if (ProviderRegistry.getSupportedProviders().length === 0) {
    // Mock provider - for testing and development
    const mockMetadata: ProviderMetadata = {
      name: DEFAULTS.PROVIDER_MOCK,
      description: DEFAULTS.PROVIDER_MOCK_DESCRIPTION,
      capabilities: DEFAULTS.PROVIDER_MOCK_CAPABILITIES,
      costTier: DEFAULTS.PROVIDER_COST_TIER_FREE,
      pricingTier: PricingTier.FREE,
      strengths: DEFAULTS.PROVIDER_MOCK_STRENGTHS,
    };
    ProviderRegistry.registerWithMetadata(DEFAULTS.PROVIDER_MOCK, new MockProviderFactory(), mockMetadata);

    // Ollama provider - local open-source models
    const ollamaMetadata: ProviderMetadata = {
      name: DEFAULTS.PROVIDER_OLLAMA,
      description: DEFAULTS.PROVIDER_OLLAMA_DESCRIPTION,
      capabilities: DEFAULTS.PROVIDER_OLLAMA_CAPABILITIES,
      costTier: DEFAULTS.PROVIDER_COST_TIER_FREE,
      pricingTier: PricingTier.LOCAL,
      strengths: DEFAULTS.PROVIDER_OLLAMA_STRENGTHS,
    };
    ProviderRegistry.registerWithMetadata(DEFAULTS.PROVIDER_OLLAMA, new OllamaProviderFactory(), ollamaMetadata);

    // Anthropic provider - Claude models
    const anthropicMetadata: ProviderMetadata = {
      name: DEFAULTS.PROVIDER_ANTHROPIC,
      description: DEFAULTS.PROVIDER_ANTHROPIC_DESCRIPTION,
      capabilities: DEFAULTS.PROVIDER_ANTHROPIC_CAPABILITIES,
      costTier: DEFAULTS.PROVIDER_COST_TIER_PAID,
      pricingTier: PricingTier.HIGH,
      strengths: DEFAULTS.PROVIDER_ANTHROPIC_STRENGTHS,
    };
    ProviderRegistry.registerWithMetadata(
      DEFAULTS.PROVIDER_ANTHROPIC,
      new AnthropicProviderFactory(),
      anthropicMetadata,
    );

    // OpenAI provider - GPT models
    const openaiMetadata: ProviderMetadata = {
      name: DEFAULTS.PROVIDER_OPENAI,
      description: DEFAULTS.PROVIDER_OPENAI_DESCRIPTION,
      capabilities: DEFAULTS.PROVIDER_OPENAI_CAPABILITIES,
      costTier: DEFAULTS.PROVIDER_COST_TIER_PAID,
      pricingTier: PricingTier.MEDIUM,
      strengths: DEFAULTS.PROVIDER_OPENAI_STRENGTHS,
    };
    ProviderRegistry.registerWithMetadata(
      DEFAULTS.PROVIDER_OPENAI,
      new OpenAIProviderFactory(),
      openaiMetadata,
    );

    // Google provider - Gemini models
    const googleMetadata: ProviderMetadata = {
      name: DEFAULTS.PROVIDER_GOOGLE,
      description: DEFAULTS.PROVIDER_GOOGLE_DESCRIPTION,
      capabilities: DEFAULTS.PROVIDER_GOOGLE_CAPABILITIES,
      costTier: DEFAULTS.PROVIDER_COST_TIER_FREEMIUM,
      pricingTier: PricingTier.LOW,
      strengths: DEFAULTS.PROVIDER_GOOGLE_STRENGTHS,
    };
    ProviderRegistry.registerWithMetadata(
      DEFAULTS.PROVIDER_GOOGLE,
      new GoogleProviderFactory(),
      googleMetadata,
    );
  }
}

// ============================================================================
// Provider Validation and Health Checks
// ============================================================================

/**
 * Validate that a provider connection is working by making a lightweight test request.
 * This is used for health checks in fallback chains.
 *
 * @param provider - The provider to validate
 * @returns Promise that resolves if connection is healthy, rejects if not
 */
export async function validateProviderConnection(provider: IModelProvider): Promise<void> {
  try {
    // Use a minimal test prompt that should work with any provider
    const testPrompt = DEFAULTS.PROVIDER_HEALTH_CHECK_TEST_PROMPT;
    const testOptions = {
      max_tokens: DEFAULTS.PROVIDER_HEALTH_CHECK_MAX_TOKENS,
      temperature: DEFAULTS.PROVIDER_HEALTH_CHECK_TEMPERATURE,
    };

    // Create a timeout promise with proper cleanup
    let timeoutId: number | undefined;
    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutId = setTimeout(
        () => reject(new Error("Health check timeout")),
        DEFAULTS.PROVIDER_HEALTH_CHECK_TIMEOUT_MS,
      );
    });

    try {
      // Race the health check against the timeout
      await Promise.race([
        provider.generate(testPrompt, testOptions),
        timeoutPromise,
      ]);
    } finally {
      // Always clear the timeout to prevent leaks
      if (timeoutId !== undefined) {
        clearTimeout(timeoutId);
      }
    }
  } catch (error) {
    throw new ProviderFactoryError(
      `Provider ${provider.id} health check failed: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

// Helper for tests: get provider by model name
export async function getProviderForModel(model: string) {
  // Minimal mock config for test
  const config = {
    ai: { provider: "ollama", model },
  } as any;
  return await ProviderFactory.create(config);
}
