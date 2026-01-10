/**
 * Provider Registry Pattern - Decouples ProviderFactory from concrete implementations
 *
 * Issue #10: Tight Coupling Between Services
 *
 * This module implements a registry pattern to eliminate tight coupling between
 * the ProviderFactory and concrete provider implementations. Instead of directly
 * importing and instantiating provider classes, the factory now uses registered
 * factory functions that encapsulate the creation logic.
 *
 * Benefits:
 * - Loose coupling: Factory doesn't need to know concrete provider details
 * - Testability: Provider creation can be easily mocked
 * - Extensibility: New providers can be added without modifying factory code
 * - Plugin support: Third-party providers can register themselves
 */

import { IModelProvider } from "./providers.ts";
import { ResolvedProviderOptions } from "./provider_factory.ts";
import { MockLLMProvider } from "./providers/mock_llm_provider.ts";
import { OllamaProvider } from "./providers.ts";
import { LlamaProvider } from "./providers/llama_provider.ts";
import { SecureCredentialStore } from "../utils/credential_security.ts";
import { OpenAIProvider } from "./providers/openai_provider.ts";
import { AnthropicProvider } from "./providers/anthropic_provider.ts";
import { GoogleProvider } from "./providers/google_provider.ts";
import { ProviderFactoryError } from "./provider_factory.ts";
// ============================================================================
// Interfaces
// ============================================================================

/**
 * Interface that all provider factories must implement.
 * Defines the contract for creating provider instances.
 */
export interface IProviderFactory {
  /**
   * Create a provider instance with the given options.
   * @param options Resolved provider configuration options
   * @returns A configured provider instance
   */
  create(options: ResolvedProviderOptions): Promise<IModelProvider>;

  /**
   * Get the list of provider types this factory supports.
   * Used for registry queries and validation.
   * @returns Array of supported provider type strings
   */
  getSupportedProviders(): string[];
}

// ============================================================================
// Provider Registry
// ============================================================================

/**
 * Registry for provider factories.
 * Manages registration and lookup of provider factories by type.
 */
export class ProviderRegistry {
  private static factories = new Map<string, IProviderFactory>();

  /**
   * Register a factory for a specific provider type.
   * @param providerType The provider type this factory handles
   * @param factory The factory instance
   */
  static register(providerType: string, factory: IProviderFactory): void {
    this.factories.set(providerType, factory);
  }

  /**
   * Get the factory for a specific provider type.
   * @param providerType The provider type to look up
   * @returns The factory instance, or undefined if not registered
   */
  static getFactory(providerType: string): IProviderFactory | undefined {
    return this.factories.get(providerType);
  }

  /**
   * Get all registered provider types.
   * @returns Array of all registered provider type strings
   */
  static getSupportedProviders(): string[] {
    return Array.from(this.factories.keys());
  }

  /**
   * Clear all registered factories.
   * Primarily used for testing to ensure test isolation.
   */
  static clear(): void {
    this.factories.clear();
  }
}

// ============================================================================
// Concrete Factory Implementations
// ============================================================================

/**
 * Factory for creating MockLLMProvider instances.
 */
export class MockProviderFactory implements IProviderFactory {
  async create(options: ResolvedProviderOptions): Promise<IModelProvider> {
    const strategy = options.mockStrategy ?? "recorded";

    return await new MockLLMProvider(strategy, {
      id: `mock-${strategy}-${options.model}`,
      fixtureDir: options.mockFixturesDir,
    });
  }

  getSupportedProviders(): string[] {
    return ["mock"];
  }
}

/**
 * Factory for creating OllamaProvider instances.
 */
export class OllamaProviderFactory implements IProviderFactory {
  async create(options: ResolvedProviderOptions): Promise<IModelProvider> {
    return await new OllamaProvider({
      id: `ollama-${options.model}`,
      model: options.model,
      baseUrl: options.baseUrl,
      timeoutMs: options.timeoutMs,
    });
  }

  getSupportedProviders(): string[] {
    return ["ollama"];
  }
}

/**
 * Factory for creating LlamaProvider instances.
 */
export class LlamaProviderFactory implements IProviderFactory {
  async create(options: ResolvedProviderOptions): Promise<IModelProvider> {
    return await new LlamaProvider({
      model: options.model,
      endpoint: options.baseUrl,
    });
  }

  getSupportedProviders(): string[] {
    return ["llama"];
  }
}

/**
 * Factory for creating AnthropicProvider instances.
 */
export class AnthropicProviderFactory implements IProviderFactory {
  async create(options: ResolvedProviderOptions): Promise<IModelProvider> {
    const apiKey = await SecureCredentialStore.get("ANTHROPIC_API_KEY");
    if (!apiKey) {
      throw new ProviderFactoryError("Authentication failed");
    }

    return new AnthropicProvider({
      apiKey,
      model: options.model,
      id: `anthropic-${options.model}`,
    });
  }

  getSupportedProviders(): string[] {
    return ["anthropic"];
  }
}

/**
 * Factory for creating OpenAIProvider instances.
 */
export class OpenAIProviderFactory implements IProviderFactory {
  async create(options: ResolvedProviderOptions): Promise<IModelProvider> {
    const apiKey = await SecureCredentialStore.get("OPENAI_API_KEY");
    if (!apiKey) {
      throw new ProviderFactoryError("Authentication failed");
    }

    return new OpenAIProvider({
      apiKey,
      model: options.model,
      baseUrl: options.baseUrl,
      id: `openai-${options.model}`,
    });
  }

  getSupportedProviders(): string[] {
    return ["openai"];
  }
}

/**
 * Factory for creating GoogleProvider instances.
 */
export class GoogleProviderFactory implements IProviderFactory {
  async create(options: ResolvedProviderOptions): Promise<IModelProvider> {
    const apiKey = await SecureCredentialStore.get("GOOGLE_API_KEY");
    if (!apiKey) {
      throw new ProviderFactoryError("Authentication failed");
    }

    return new GoogleProvider({
      apiKey,
      model: options.model,
      id: `google-${options.model}`,
    });
  }

  getSupportedProviders(): string[] {
    return ["google"];
  }
}
