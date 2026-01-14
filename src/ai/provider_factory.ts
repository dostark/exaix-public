/**
 * ProviderFactory - LLM Provider Selection Logic
 *
 * Creates the appropriate LLM provider based on:
 * 1. Environment variables (highest priority)
 * 2. Config file [ai] section (medium priority)
 * 3. Defaults (lowest priority) - MockLLMProvider for safety
 */
import * as DEFAULTS from "../config/constants.ts";
import { IModelProvider, OllamaProvider } from "./providers.ts";
import { MockLLMProvider, MockStrategy } from "./providers/mock_llm_provider.ts";
import { Config } from "../config/schema.ts";
import { AiConfig, DEFAULT_MODELS, ProviderType } from "../config/ai_config.ts";
import { LlamaProvider } from "./providers/llama_provider.ts";
import { AnthropicProvider } from "./providers/anthropic_provider.ts";
import { OpenAIProvider } from "./providers/openai_provider.ts";
import { GoogleProvider } from "./providers/google_provider.ts";
import { SecureCredentialStore } from "../utils/credential_security.ts";
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
  ProviderRegistry,
} from "./provider_registry.ts";
import { RateLimitedProvider } from "./rate_limited_provider.ts";

// ============================================================================
// Types and Interfaces
// ============================================================================

/**
 * Resolved provider options after merging env vars and config
 */
export interface ResolvedProviderOptions {
  /** Provider type */
  provider: ProviderType;
  /** Model name */
  model: string;
  /** API base URL */
  baseUrl?: string;
  /** Timeout in milliseconds */
  timeoutMs: number;
  /** API key (for cloud providers) */
  apiKey?: string;
  /** Mock strategy */
  mockStrategy?: MockStrategy;
  /** Mock fixtures directory */
  mockFixturesDir?: string;
}

/**
 * Provider information for logging/debugging
 */
export interface ProviderInfo {
  /** Provider type */
  type: ProviderType;
  /** Provider ID */
  id: string;
  /** Model name */
  model: string;
  /** Source of configuration */
  source: "env" | "config" | "default";
}

// ============================================================================
// Custom Error Type
// ============================================================================

/**
 * Error thrown by ProviderFactory
 */
export class ProviderFactoryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ProviderFactoryError";
  }
}

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
      provider: "mock",
      timeout_ms: DEFAULTS.DEFAULT_AI_TIMEOUT_MS,
    };

    // Merge model-level config (may be from config.models[name]) on top of baseAi
    const merged: Partial<AiConfig> = {
      ...baseAi,
      ...(modelConfig ?? {}),
    };

    // Resolve provider type (env > modelConfig > global)
    let providerType: ProviderType = "mock";
    if (envProvider) {
      const normalized = envProvider.toLowerCase().trim();
      if (["mock", "ollama", "anthropic", "openai", "google"].includes(normalized)) {
        providerType = normalized as ProviderType;
      } else {
        console.warn(`Unknown provider '${envProvider}' from EXO_LLM_PROVIDER, falling back to mock`);
        providerType = "mock";
      }
    } else if (merged.provider) {
      providerType = merged.provider as ProviderType;
    }

    // Resolve model (env > merged.model > default per provider)
    const model = envModel ?? (merged.model ?? DEFAULT_MODELS[providerType]);

    // Resolve base url and timeout (env > merged > defaults)
    const baseUrl = envBaseUrl ?? merged.base_url;

    // Resolve timeout with provider-specific fallback from ai_timeout config
    let timeoutMs = DEFAULTS.DEFAULT_AI_TIMEOUT_MS;
    if (envTimeout) {
      timeoutMs = parseInt(envTimeout, 10);
    } else if (merged.timeout_ms) {
      timeoutMs = merged.timeout_ms;
    } else if (config.ai_timeout && providerType !== "mock") {
      const providerTimeout = config.ai_timeout[providerType as keyof typeof config.ai_timeout];
      if (providerTimeout) {
        timeoutMs = providerTimeout;
      }
    }

    // Mock-specific
    const mockStrategy = merged.mock?.strategy ?? baseAi?.mock?.strategy ?? "recorded";
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
      return await factory.create(options);
    }

    // Fall back to legacy direct instantiation for backward compatibility
    return await this.createProviderLegacy(options);
  }

  /**
   * Legacy provider creation for backward compatibility
   * TODO: Deprecate this method once all providers are migrated to registry
   */
  private static async createProviderLegacy(options: ResolvedProviderOptions): Promise<IModelProvider> {
    // Llama/Ollama model routing
    if (/^(codellama:|llama[0-9.]*:)/.test(options.model)) {
      return new LlamaProvider({ model: options.model, endpoint: options.baseUrl });
    }
    switch (options.provider) {
      case "mock":
        return this.createMockProvider(options);

      case "ollama":
        return this.createOllamaProvider(options);

      case "anthropic":
        return await this.createAnthropicProvider(options);

      case "openai":
        return await this.createOpenAIProvider(options);
      case "google":
        return await this.createGoogleProvider(options);

      default:
        // This shouldn't happen due to Zod validation, but just in case
        console.warn(`Unknown provider '${options.provider}', falling back to mock`);
        return this.createMockProvider(options);
    }
  }

  /**
   * Create a MockLLMProvider
   */
  private static createMockProvider(options: ResolvedProviderOptions): MockLLMProvider {
    const strategy = options.mockStrategy ?? "recorded";

    return new MockLLMProvider(strategy, {
      id: this.generateProviderId(options),
      fixtureDir: options.mockFixturesDir,
    });
  }

  /**
   * Create an OllamaProvider
   */
  private static createOllamaProvider(options: ResolvedProviderOptions): OllamaProvider {
    return new OllamaProvider({
      id: this.generateProviderId(options),
      model: options.model,
      baseUrl: options.baseUrl,
      timeoutMs: options.timeoutMs,
    });
  }

  /**
   * Create an Anthropic provider
   */
  private static async createAnthropicProvider(options: ResolvedProviderOptions): Promise<IModelProvider> {
    const apiKey = await SecureCredentialStore.get("ANTHROPIC_API_KEY");
    if (!apiKey) {
      throw new ProviderFactoryError("Authentication failed");
    }

    return new AnthropicProvider({
      apiKey,
      model: options.model,
      id: this.generateProviderId(options),
      timeoutMs: options.timeoutMs,
    });
  }

  /**
   * Create an OpenAI provider (stub - throws if no API key)
   */
  private static async createOpenAIProvider(options: ResolvedProviderOptions): Promise<IModelProvider> {
    const apiKey = await SecureCredentialStore.get("OPENAI_API_KEY");
    if (!apiKey) {
      throw new ProviderFactoryError("Authentication failed");
    }

    return new OpenAIProvider({
      apiKey,
      model: options.model,
      baseUrl: options.baseUrl,
      id: this.generateProviderId(options),
      timeoutMs: options.timeoutMs,
    });
  }

  /**
   * Generate a unique provider ID
   */
  private static generateProviderId(options: ResolvedProviderOptions): string {
    switch (options.provider) {
      case "mock":
        return `mock-${options.mockStrategy ?? "recorded"}-${options.model}`;
      case "ollama":
        return `ollama-${options.model}`;
      case "anthropic":
        return `anthropic-${options.model}`;
      case "openai":
        return `openai-${options.model}`;
      case "google":
        return `google-${options.model}`;
      default:
        return `unknown-${options.provider}`;
    }
  }

  /**
   * Create a Google provider
   */
  private static async createGoogleProvider(options: ResolvedProviderOptions): Promise<IModelProvider> {
    const apiKey = await SecureCredentialStore.get("GOOGLE_API_KEY");
    if (!apiKey) {
      throw new ProviderFactoryError("Authentication failed");
    }

    return new GoogleProvider({
      apiKey,
      model: options.model,
      id: this.generateProviderId(options),
      timeoutMs: options.timeoutMs,
    });
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
 * Initialize default provider factories in registry (lazy initialization)
 */
function initializeRegistry(): void {
  // Only initialize if not already done
  if (ProviderRegistry.getSupportedProviders().length === 0) {
    ProviderRegistry.register("mock", new MockProviderFactory());
    ProviderRegistry.register("ollama", new OllamaProviderFactory());
    ProviderRegistry.register("anthropic", new AnthropicProviderFactory());
    ProviderRegistry.register("openai", new OpenAIProviderFactory());
    ProviderRegistry.register("google", new GoogleProviderFactory());
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
    const testPrompt = "Hello";
    const testOptions = { max_tokens: 1, temperature: 0 };

    // Create a timeout promise with proper cleanup
    let timeoutId: number | undefined;
    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutId = setTimeout(() => reject(new Error("Health check timeout")), 5000);
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
