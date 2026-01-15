/**
 * Model Adapter - Provides a unified interface for interacting with various LLM providers.
 * Implements Step 3.1 of the ExoFrame Implementation Plan.
 */

// @ts-ignore: Deno is a global in the Deno runtime
declare const Deno: any;

import { ProviderRegistry } from "./provider_registry.ts";
import { ResolvedProviderOptions } from "./provider_factory.ts";
import {
  DEFAULT_OLLAMA_BASE_URL,
  DEFAULT_OLLAMA_MODEL,
  DEFAULT_OLLAMA_RETRY_BACKOFF_MS,
  DEFAULT_OLLAMA_RETRY_MAX_ATTEMPTS,
  DEFAULT_OLLAMA_TIMEOUT_MS,
  DEFAULT_OPENAI_BASE_URL,
  DEFAULT_OPENAI_MODEL,
  DEFAULT_OPENAI_RETRY_BACKOFF_MS,
  DEFAULT_OPENAI_RETRY_MAX_ATTEMPTS,
  DEFAULT_OPENAI_TIMEOUT_MS,
  MOCK_DELAY_MS,
} from "../config/constants.ts";

// Import error classes from common
import { ConnectionError, ModelProviderError, TimeoutError } from "./providers/common.ts";

// ============================================================================
// Types and Interfaces
// ============================================================================

/**
 * Options for model generation requests.
 */
export interface ModelOptions {
  temperature?: number;
  max_tokens?: number;
  top_p?: number;
  stop?: string[];
  stream?: boolean;
}

/**
 * Standard interface that all model providers must implement.
 */
export interface IModelProvider {
  /** Unique identifier for this provider instance. */
  id: string;

  /**
   * Generate a response from the model.
   * @param prompt The input prompt to send to the model
   * @param options Optional generation parameters
   * @returns The generated text response
   */
  generate(prompt: string, options?: ModelOptions): Promise<string>;
}

// ============================================================================
// Mock Provider (for testing)
// ============================================================================

/**
 * Mock provider that returns a predictable, configurable response.
 * Used for unit testing and development.
 */
export class MockProvider implements IModelProvider {
  public readonly id: string;

  constructor(
    private readonly response: string,
    id: string = "mock-provider",
  ) {
    this.id = id;
  }

  async generate(_prompt: string, _options?: ModelOptions): Promise<string> {
    // Simulate async behavior
    await new Promise((resolve) => setTimeout(resolve, MOCK_DELAY_MS));
    return this.response;
  }
}

// ============================================================================
// Ollama Provider (local inference)
// ============================================================================

/**
 * Provider for Ollama local LLM inference.
 * Communicates with Ollama API at localhost:11434.
 */
export class OllamaProvider implements IModelProvider {
  public readonly id: string;
  private readonly baseUrl: string;
  private readonly defaultModel: string;
  private readonly timeoutMs: number;

  constructor(
    options: {
      baseUrl?: string;
      model?: string;
      timeoutMs?: number;
      id?: string;
    } = {},
  ) {
    this.baseUrl = options.baseUrl ?? DEFAULT_OLLAMA_BASE_URL;
    this.defaultModel = options.model ?? DEFAULT_OLLAMA_MODEL;
    this.timeoutMs = options.timeoutMs ?? DEFAULT_OLLAMA_TIMEOUT_MS;
    this.id = options.id ?? `ollama-${this.defaultModel}`;
  }

  async generate(prompt: string, options?: ModelOptions): Promise<string> {
    try {
      // Import helper dynamically to avoid module cycles
      const { fetchJsonWithRetries } = await import("./provider_common_utils.ts");
      const data = await fetchJsonWithRetries(
        `${this.baseUrl}/api/generate`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: this.defaultModel,
            prompt: prompt,
            stream: false,
            options: {
              temperature: options?.temperature,
              num_predict: options?.max_tokens,
              top_p: options?.top_p,
              stop: options?.stop,
            },
          }),
        },
        {
          id: this.id,
          maxAttempts: Number(safeGetEnv("EXO_OLLAMA_RETRY_MAX") ?? DEFAULT_OLLAMA_RETRY_MAX_ATTEMPTS.toString()),
          backoffBaseMs: Number(
            safeGetEnv("EXO_OLLAMA_RETRY_BACKOFF_MS") ?? DEFAULT_OLLAMA_RETRY_BACKOFF_MS.toString(),
          ),
          timeoutMs: this.timeoutMs,
        },
      );

      if (!data.response) {
        throw new ModelProviderError(
          "Invalid response from Ollama: missing 'response' field",
          this.id,
        );
      }

      return data.response;
    } catch (error) {
      if (error instanceof ModelProviderError) {
        throw error;
      }

      if (error instanceof Error && error.name === "AbortError") {
        throw new TimeoutError(this.id, this.timeoutMs);
      }

      if (error instanceof TypeError && error.message.includes("fetch")) {
        throw new ConnectionError(
          this.id,
          `Failed to connect to Ollama at ${this.baseUrl}. Is Ollama running?`,
        );
      }

      throw new ModelProviderError(
        `Unexpected error: ${error instanceof Error ? error.message : String(error)}`,
        this.id,
      );
    }
  }
}

// ============================================================================
// Model Factory
// ============================================================================

/**
 * Safe environment accessor that returns undefined if env access is not permitted in test environments.
 */
function safeGetEnv(key: string): string | undefined {
  try {
    return Deno.env.get(key);
  } catch {
    return undefined;
  }
}

/**
 * Minimal OpenAI-compatible shim used by the factory to create quick model-specific adapters
 * without importing the full `OpenAIProvider` implementation (avoids circular imports).
 */

class OpenAIShim implements IModelProvider {
  public readonly id: string;
  private readonly apiKey: string;
  private readonly model: string;
  private readonly baseUrl: string;

  constructor(options: { apiKey?: string; model?: string; baseUrl?: string; id?: string }) {
    this.apiKey = options.apiKey ?? "";
    this.model = options.model ?? DEFAULT_OPENAI_MODEL;
    this.baseUrl = options.baseUrl ?? DEFAULT_OPENAI_BASE_URL;
    this.id = options.id ?? `openai-${this.model}`;
  }

  async generate(prompt: string, _options?: ModelOptions): Promise<string> {
    const url = `${this.baseUrl}/v1/chat/completions`;

    // Make retry parameters configurable via env for manual runs; defaults longer to reduce 429 frequency
    const maxAttempts = Number(safeGetEnv("EXO_OPENAI_RETRY_MAX") ?? DEFAULT_OPENAI_RETRY_MAX_ATTEMPTS.toString());
    const backoffBaseMs = Number(
      safeGetEnv("EXO_OPENAI_RETRY_BACKOFF_MS") ?? DEFAULT_OPENAI_RETRY_BACKOFF_MS.toString(),
    );
    const timeoutMs = Number(safeGetEnv("EXO_OPENAI_TIMEOUT_MS") ?? DEFAULT_OPENAI_TIMEOUT_MS.toString());

    // Import helpers dynamically to avoid module initialization cycles
    const { fetchJsonWithRetries, extractOpenAIContent, tokenMapperOpenAI } = await import(
      "./provider_common_utils.ts"
    );

    const data = await fetchJsonWithRetries(
      url,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({ model: this.model, messages: [{ role: "user", content: prompt }] }),
      },
      {
        id: this.id,
        maxAttempts,
        backoffBaseMs,
        timeoutMs,
        tokenMapper: tokenMapperOpenAI(this.model),
      },
    );

    const content = extractOpenAIContent(data);
    if (!content) {
      throw new ModelProviderError("Invalid response from OpenAI-compatible endpoint", this.id);
    }
    return content;
  }
}

/**
 * Factory for creating model provider instances based on configuration.
 */
export class ModelFactory {
  /**
   * Create a model provider instance.
   * @param providerType Type of provider ("mock", "ollama", etc.)
   * @param config Provider-specific configuration
   * @returns An instance implementing IModelProvider
   */
  static async create(
    providerType: string,
    config?: Record<string, unknown>,
  ): Promise<IModelProvider> {
    const normalizedType = providerType.toLowerCase().trim();

    // Initialize registry if needed
    if (ProviderRegistry.getSupportedProviders().length === 0) {
      // Import here to avoid circular dependency
      const { initializeRegistry } = await import("./provider_factory.ts");
      initializeRegistry();
    }

    // Check if this is a registered provider type
    if (ProviderRegistry.getSupportedProviders().includes(normalizedType)) {
      // Use registry-based factory creation
      const factory = ProviderRegistry.getFactory(normalizedType);
      if (factory) {
        const options: ResolvedProviderOptions = {
          provider: normalizedType as any,
          model: (config?.model as string) ?? "default-model",
          baseUrl: config?.baseUrl as string,
          timeoutMs: (config?.timeoutMs as number) ?? 30000,
          apiKey: config?.apiKey as string,
          id: config?.id as string ?? (normalizedType === "mock" ? "mock-provider" : undefined),
          mockStrategy:
            (config?.mockStrategy ?? config?.strategy ?? (config?.response ? "scripted" : undefined)) as any,
          mockFixturesDir: config?.mockFixturesDir as string,
          // Support 'response' for backward compatibility with tests
          responses: config?.response ? [config.response as string] : undefined,
        } as any;
        return await factory.create(options);
      }
    }

    // Handle convenience aliases for OpenAI-compatible models
    if (normalizedType.startsWith("gpt-")) {
      // In CI, prevent accidental calls to paid endpoints unless explicitly opted-in
      if (safeGetEnv("CI") && safeGetEnv("EXO_ENABLE_PAID_LLM") !== "1") {
        return new MockProvider("CI-protected mock", (config?.id as string) ?? "mock-provider");
      }

      return new OpenAIShim({
        apiKey: config?.apiKey as string ?? "",
        // Use the original providerType (preserve exact model id) when contacting the API
        model: providerType,
        baseUrl: config?.baseUrl as string | undefined,
        id: (config?.id as string) ?? `openai-${providerType}`,
      });
    }

    // If we reach here, the provider type is unknown
    throw new Error(
      `Unknown provider type: '${providerType}'. Supported types: ${
        ProviderRegistry.getSupportedProviders().join(", ")
      }`,
    );
  }
}

// Re-export error classes from common.ts for backward compatibility
export { ConnectionError, ModelProviderError, TimeoutError } from "./providers/common.ts";
