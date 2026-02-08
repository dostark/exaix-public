import { assertEquals } from "@std/assert";
import { ProviderType } from "../../src/enums.ts";
import { DEFAULT_OLLAMA_ENDPOINT } from "../../src/config/constants.ts";
import { LlamaProviderFactory } from "../../src/ai/factories/llama_factory.ts";

Deno.test("LlamaProviderFactory.create wires model + baseUrl into LlamaProvider", async () => {
  const factory = new LlamaProviderFactory();

  const provider = await factory.create({
    provider: ProviderType.OLLAMA,
    model: "llama3.2:test",
    baseUrl: "http://example.test/api",
    timeoutMs: 1000,
  });

  assertEquals(provider.id, "llama-llama3.2:test");
  assertEquals((provider as any).model, "llama3.2:test");
  assertEquals((provider as any).endpoint, "http://example.test/api");
});

Deno.test("LlamaProviderFactory.create uses default endpoint when baseUrl is missing", async () => {
  const factory = new LlamaProviderFactory();

  const provider = await factory.create({
    provider: ProviderType.OLLAMA,
    model: "llama3.2:test",
    timeoutMs: 1000,
  });

  assertEquals((provider as any).endpoint, DEFAULT_OLLAMA_ENDPOINT);
});
