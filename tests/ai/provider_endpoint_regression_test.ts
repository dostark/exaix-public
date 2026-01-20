import { assertEquals, assertStringIncludes } from "@std/assert";
import { GoogleProvider } from "../../src/ai/providers/google_provider.ts";
import { OpenAIProvider } from "../../src/ai/providers/openai_provider.ts";
import { AnthropicProvider } from "../../src/ai/providers/anthropic_provider.ts";
import { DEFAULT_ANTHROPIC_MODEL, DEFAULT_GOOGLE_MODEL, DEFAULT_OPENAI_MODEL } from "../../src/config/constants.ts";

/**
 * Regression test for: "HTTP 404 models/gemini-2.0-flash-exp is not found for API version v1"
 * Root cause: Default endpoint was set to v1, but gemini-2.0 requires v1beta.
 * Fix: Updated DEFAULT_GOOGLE_ENDPOINT to v1beta.
 *
 * This test uses a mock fetch to verify the constructed API URLs for all providers.
 */

// Mock fetch to capture request details
const originalFetch = globalThis.fetch;
let lastUrl: string | undefined;
let lastMethod: string | undefined;

function mockFetch(input: string | URL | Request, init?: RequestInit): Promise<Response> {
  if (typeof input === "string") {
    lastUrl = input;
  } else if (input instanceof URL) {
    lastUrl = input.toString();
  } else if (input instanceof Request) {
    lastUrl = input.url;
  }

  if (init) {
    lastMethod = init.method;
  }

  // Return a realistic-looking success response structure for each provider to prevent parse errors
  const responseBody = {
    // Google
    candidates: [{ content: { parts: [{ text: "Google Response" }] } }],
    // OpenAI
    choices: [{ message: { content: "OpenAI Response" } }],
    // Anthropic
    content: [{ text: "Anthropic Response" }],
  };

  return Promise.resolve(
    new Response(JSON.stringify(responseBody), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }),
  );
}

Deno.test("[regression] GoogleProvider uses v1beta endpoint for Gemini models", async () => {
  globalThis.fetch = mockFetch;
  try {
    const provider = new GoogleProvider({
      apiKey: "dummy-key",
      model: DEFAULT_GOOGLE_MODEL, // gemini-2.0-flash-exp
    });

    await provider.generate("Test prompt");

    assertStringIncludes(lastUrl!, "https://generativelanguage.googleapis.com/v1beta/models");
    assertStringIncludes(lastUrl!, DEFAULT_GOOGLE_MODEL); // Verify it uses the constant (e.g. gemini-2.0-flash-exp)
    assertEquals(lastMethod, "POST");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

Deno.test("[regression] OpenAIProvider uses v1/chat/completions endpoint", async () => {
  globalThis.fetch = mockFetch;
  try {
    const provider = new OpenAIProvider({
      apiKey: "dummy-key",
      model: DEFAULT_OPENAI_MODEL,
    });

    await provider.generate("Test prompt");

    assertStringIncludes(lastUrl!, "https://api.openai.com/v1/chat/completions");
    assertEquals(lastMethod, "POST");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

Deno.test("[regression] AnthropicProvider uses v1/messages endpoint", async () => {
  globalThis.fetch = mockFetch;
  try {
    const provider = new AnthropicProvider({
      apiKey: "dummy-key",
      model: DEFAULT_ANTHROPIC_MODEL,
    });

    await provider.generate("Test prompt");

    assertStringIncludes(lastUrl!, "https://api.anthropic.com/v1/messages");
    assertEquals(lastMethod, "POST");
  } finally {
    globalThis.fetch = originalFetch;
  }
});
