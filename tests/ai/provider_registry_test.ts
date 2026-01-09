/**
 * Tests for Provider Registry Pattern (Issue #10: Tight Coupling Between Services)
 */

import { assertEquals, assertExists, assertThrows } from "jsr:@std/assert@^1.0.0";
import { AnthropicProviderFactory, MockProviderFactory, ProviderRegistry } from "../../src/ai/provider_registry.ts";
import { ResolvedProviderOptions } from "../../src/ai/provider_factory.ts";
import { ProviderFactory } from "../../src/ai/provider_factory.ts";
import { Config } from "../../src/config/schema.ts";

// ============================================================================
// Basic Registry Tests
// ============================================================================

Deno.test("ProviderRegistry: can register and retrieve factories", () => {
  ProviderRegistry.clear();
  const factory = new MockProviderFactory();

  ProviderRegistry.register("test-mock", factory);
  const retrieved = ProviderRegistry.getFactory("test-mock");

  assertExists(retrieved);
  assertEquals(retrieved.getSupportedProviders(), ["mock"]);
});

Deno.test("ProviderRegistry: returns undefined for unregistered providers", () => {
  ProviderRegistry.clear();
  const retrieved = ProviderRegistry.getFactory("non-existent");
  assertEquals(retrieved, undefined);
});

Deno.test("MockProviderFactory: creates providers", () => {
  const factory = new MockProviderFactory();
  const options: ResolvedProviderOptions = {
    provider: "mock",
    model: "test-model",
    timeoutMs: 30000,
    mockStrategy: "recorded",
  };

  const provider = factory.create(options);
  assertExists(provider);
  assertEquals(provider.id, "mock-recorded-test-model");
});

Deno.test("AnthropicProviderFactory: requires API key", () => {
  // Ensure API key is not set
  Deno.env.delete("ANTHROPIC_API_KEY");

  const factory = new AnthropicProviderFactory();
  const options: ResolvedProviderOptions = {
    provider: "anthropic",
    model: "claude-3-sonnet",
    timeoutMs: 30000,
  };

  assertThrows(
    () => factory.create(options),
    Error,
    "Anthropic provider requires ANTHROPIC_API_KEY",
  );
});

Deno.test("AnthropicProviderFactory: exists and has correct interface", () => {
  const factory = new AnthropicProviderFactory();
  assertEquals(factory.getSupportedProviders(), ["anthropic"]);
});

Deno.test("ProviderFactory: uses registry for mock provider", () => {
  const config = {
    system: {
      root: "/tmp/test",
      log_level: "info" as const,
    },
    paths: {
      portals: "Portals",
      workspace: "Workspace",
      memory: "Memory",
      runtime: ".exo",
      blueprints: "Blueprints",
    },
    ai: {
      provider: "mock",
      model: "test-model",
    },
  } as Config;

  const provider = ProviderFactory.create(config);
  assertExists(provider);
  assertEquals(provider.id, "mock-recorded-test-model");
});

Deno.test("ProviderFactory: maintains backward compatibility for ollama", () => {
  const config = {
    system: {
      root: "/tmp/test",
      log_level: "info" as const,
    },
    paths: {
      portals: "Portals",
      workspace: "Workspace",
      memory: "Memory",
      runtime: ".exo",
      blueprints: "Blueprints",
    },
    ai: {
      provider: "ollama",
      model: "llama3.2",
    },
  } as Config;

  const provider = ProviderFactory.create(config);
  assertExists(provider);
  assertEquals(provider.id, "ollama-llama3.2");
});
