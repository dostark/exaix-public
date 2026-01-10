/**
 * Tests for Provider Registry Pattern (Issue #10: Tight Coupling Between Services)
 */

import { assertEquals, assertExists, assertRejects } from "jsr:@std/assert@^1.0.0";
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

Deno.test("MockProviderFactory: creates providers", async () => {
  const factory = new MockProviderFactory();
  const options: ResolvedProviderOptions = {
    provider: "mock",
    model: "test-model",
    timeoutMs: 30000,
    mockStrategy: "recorded",
  };

  const provider = await factory.create(options);
  assertExists(provider);
  assertEquals(provider.id, "mock-recorded-test-model");
});

Deno.test("AnthropicProviderFactory: requires API key", async () => {
  // Ensure API key is not set
  Deno.env.delete("ANTHROPIC_API_KEY");

  const factory = new AnthropicProviderFactory();
  const options: ResolvedProviderOptions = {
    provider: "anthropic",
    model: "claude-3-sonnet",
    timeoutMs: 30000,
  };

  await assertRejects(
    async () => await factory.create(options),
    Error,
    "Authentication failed",
  );
});

Deno.test("AnthropicProviderFactory: exists and has correct interface", () => {
  const factory = new AnthropicProviderFactory();
  assertEquals(factory.getSupportedProviders(), ["anthropic"]);
});

Deno.test("ProviderFactory: uses registry for mock provider", async () => {
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

  const provider = await ProviderFactory.create(config);
  assertExists(provider);
  assertEquals(provider.id, "mock-recorded-test-model");
});

Deno.test("ProviderFactory: maintains backward compatibility for ollama", async () => {
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

  const provider = await ProviderFactory.create(config);
  assertExists(provider);
  assertEquals(provider.id, "ollama-llama3.2");
});
