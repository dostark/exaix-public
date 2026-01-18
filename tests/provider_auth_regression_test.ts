/**
 * Provider Authorization Regression Test
 *
 * Regression test for: "Provider fails to initialize from environment variable API keys"
 * Root cause: Provider factories were only checking SecureCredentialStore (in-memory)
 *             and ignoring environment variables declared in process
 * Fix: Updated factories to check Deno.env.get() first, then SecureCredentialStore
 */

import { assertEquals, assertRejects } from "@std/assert";
import { AnthropicProviderFactory, GoogleProviderFactory, OpenAIProviderFactory } from "../src/ai/provider_registry.ts";
import { ResolvedProviderOptions } from "../src/ai/provider_factory.ts";
import { MockStrategy, ProviderType } from "../src/enums.ts";
import { SecureCredentialStore } from "../src/utils/credential_security.ts";

// Helper to mock resolved options
const mockOptions: ResolvedProviderOptions = {
  provider: ProviderType.ANTHROPIC,
  model: "test-model",
  timeoutMs: 1000,
  mockStrategy: MockStrategy.RECORDED,
};

Deno.test("[regression] AnthropicProviderFactory accepts API key from environment", async () => {
  const factory = new AnthropicProviderFactory();

  // Set env var
  Deno.env.set("ANTHROPIC_API_KEY", "sk-ant-test-key");

  try {
    const provider = await factory.create(mockOptions);
    assertEquals(provider.id, "anthropic-test-model");
  } finally {
    Deno.env.delete("ANTHROPIC_API_KEY");
  }
});

Deno.test("[regression] AnthropicProviderFactory throws specific error when key missing", async () => {
  const factory = new AnthropicProviderFactory();

  // Ensure no key
  Deno.env.delete("ANTHROPIC_API_KEY");
  await SecureCredentialStore.clear("ANTHROPIC_API_KEY");

  await assertRejects(
    async () => await factory.create(mockOptions),
    Error,
    "Authentication failed: ANTHROPIC_API_KEY not found",
  );
});

Deno.test("[regression] OpenAIProviderFactory accepts API key from environment", async () => {
  const factory = new OpenAIProviderFactory();
  Deno.env.set("OPENAI_API_KEY", "sk-test-key");

  try {
    const provider = await factory.create({ ...mockOptions, provider: ProviderType.OPENAI });
    assertEquals(provider.id, "openai-test-model");
  } finally {
    Deno.env.delete("OPENAI_API_KEY");
  }
});

Deno.test("[regression] GoogleProviderFactory accepts API key from environment", async () => {
  const factory = new GoogleProviderFactory();
  Deno.env.set("GOOGLE_API_KEY", "test-api-key");

  try {
    const provider = await factory.create({ ...mockOptions, provider: ProviderType.GOOGLE });
    assertEquals(provider.id, "google-test-model");
  } finally {
    Deno.env.delete("GOOGLE_API_KEY");
  }
});

// Helper for env→store sync tests
async function testEnvToStoreSync({
  providerName,
  factory,
  envKey,
  envValue,
  options,
}: {
  providerName: string;
  factory: AnthropicProviderFactory | OpenAIProviderFactory | GoogleProviderFactory;
  envKey: string;
  envValue: string;
  options: ResolvedProviderOptions;
}) {
  // Persist if opted in
  Deno.env.set(envKey, envValue);
  await SecureCredentialStore.clear(envKey);
  (globalThis as any).EXO_PERSIST_ENV_CREDENTIALS = true;
  try {
    await factory.create(options);
    const stored = await SecureCredentialStore.get(envKey);
    assertEquals(stored, envValue, `[${providerName}] should persist env key to store when opted in`);
  } finally {
    Deno.env.delete(envKey);
    await SecureCredentialStore.clear(envKey);
    delete (globalThis as any).EXO_PERSIST_ENV_CREDENTIALS;
  }

  // Do NOT persist if not opted in
  Deno.env.set(envKey, envValue);
  await SecureCredentialStore.clear(envKey);
  (globalThis as any).EXO_PERSIST_ENV_CREDENTIALS = false;
  try {
    await factory.create(options);
    const stored = await SecureCredentialStore.get(envKey);
    assertEquals(stored, null, `[${providerName}] should NOT persist env key to store when not opted in`);
  } finally {
    Deno.env.delete(envKey);
    await SecureCredentialStore.clear(envKey);
    delete (globalThis as any).EXO_PERSIST_ENV_CREDENTIALS;
  }
}

Deno.test("[env→store sync] Anthropic, OpenAI, Google: env key persistence opt-in/out", async () => {
  await testEnvToStoreSync({
    providerName: "Anthropic",
    factory: new AnthropicProviderFactory(),
    envKey: "ANTHROPIC_API_KEY",
    envValue: "sk-ant-test-key",
    options: mockOptions,
  });
  await testEnvToStoreSync({
    providerName: "OpenAI",
    factory: new OpenAIProviderFactory(),
    envKey: "OPENAI_API_KEY",
    envValue: "sk-test-key",
    options: { ...mockOptions, provider: ProviderType.OPENAI },
  });
  await testEnvToStoreSync({
    providerName: "Google",
    factory: new GoogleProviderFactory(),
    envKey: "GOOGLE_API_KEY",
    envValue: "test-api-key",
    options: { ...mockOptions, provider: ProviderType.GOOGLE },
  });
});
