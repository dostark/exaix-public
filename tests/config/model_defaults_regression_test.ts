import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { OpenAIProvider } from "../../src/ai/providers/openai_provider.ts";
import { AnthropicProvider } from "../../src/ai/providers/anthropic_provider.ts";
import { GoogleProvider } from "../../src/ai/providers/google_provider.ts";
import * as DEFAULTS from "../../src/config/constants.ts";

Deno.test("[regression] verify default openai model is gpt-5-mini", () => {
  const provider = new OpenAIProvider({ apiKey: "test-key" });
  // access private 'model' property via 'any' casting or looking at the id if it contains the model
  const id = provider.id;
  assertEquals(id, "openai-gpt-5-mini");
  assertEquals(DEFAULTS.DEFAULT_OPENAI_MODEL, "gpt-5-mini");
});

Deno.test("[regression] verify default anthropic model is claude-3.5-haiku-latest", () => {
  const provider = new AnthropicProvider({ apiKey: "test-key" });
  const id = provider.id;
  assertEquals(id, "anthropic-claude-3.5-haiku-latest");
  assertEquals(DEFAULTS.DEFAULT_ANTHROPIC_MODEL, "claude-3.5-haiku-latest");
});

Deno.test("[regression] verify default google model is gemini-2.0-flash-latest", () => {
  const provider = new GoogleProvider({ apiKey: "test-key" });
  const id = provider.id;
  assertEquals(id, "google-gemini-2.0-flash-latest");
  assertEquals(DEFAULTS.DEFAULT_GOOGLE_MODEL, "gemini-2.0-flash-latest");
});
