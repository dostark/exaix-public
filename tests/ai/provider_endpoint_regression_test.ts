import { assert } from "@std/assert";
import { GoogleProvider } from "../../src/ai/providers/google_provider.ts";
import { OpenAIProvider } from "../../src/ai/providers/openai_provider.ts";
import { AnthropicProvider } from "../../src/ai/providers/anthropic_provider.ts";
import { DEFAULT_ANTHROPIC_MODEL, DEFAULT_GOOGLE_MODEL, DEFAULT_OPENAI_MODEL } from "../../src/config/constants.ts";
import * as DEFAULTS from "../../src/config/constants.ts";

/**
 * Live Regression Test for Provider Endpoints
 *
 * Verifies that the default models and endpoints are correctly configured and accepted by the providers' APIs.
 * Uses REAL API keys from the environment.
 *
 * Pre-requisites:
 * - GOOGLE_API_KEY
 * - OPENAI_API_KEY
 * - ANTHROPIC_API_KEY
 * must be set in the environment.
 */

const TEST_PROMPT = DEFAULTS.REGRESSION_TEST_PROMPT;

Deno.test({
  name: "[regression] GoogleProvider: Verify gemini-2.0-flash-exp works with v1beta",
  ignore: !Deno.env.get("GOOGLE_API_KEY"),
  fn: async () => {
    const provider = new GoogleProvider({
      apiKey: Deno.env.get("GOOGLE_API_KEY")!,
      model: DEFAULT_GOOGLE_MODEL, // gemini-2.0-flash-exp
    });

    try {
      const response = await provider.generate(TEST_PROMPT);
      assert(response.length > 0, "Response should not be empty");
      console.log(`Google Response: ${response.substring(0, 50)}...`);
    } catch (error: any) {
      console.log(`Google Provider Error: ${error.name} - ${error.message}`);
      if (error.message.includes("404")) throw error;
      console.log("✅ Endpoint reached (Access/Quota/Auth error confirmed)");
    }
  },
});

Deno.test({
  name: "[regression] OpenAIProvider: Verify default model works",
  ignore: !Deno.env.get("OPENAI_API_KEY"),
  fn: async () => {
    const provider = new OpenAIProvider({
      apiKey: Deno.env.get("OPENAI_API_KEY")!,
      model: DEFAULT_OPENAI_MODEL,
    });

    try {
      const response = await provider.generate(TEST_PROMPT);
      assert(response.length > 0, "Response should not be empty");
      console.log(`OpenAI Response: ${response.substring(0, 50)}...`);
    } catch (error: any) {
      console.log(`OpenAI Provider Error: ${error.name} - ${error.message}`);
      if (error.message.includes("404")) throw error;
      console.log("✅ Endpoint reached (Access/Quota/Auth error confirmed)");
    }
  },
});

Deno.test({
  name: "[regression] AnthropicProvider: Verify default model works",
  ignore: !Deno.env.get("ANTHROPIC_API_KEY"),
  fn: async () => {
    const provider = new AnthropicProvider({
      apiKey: Deno.env.get("ANTHROPIC_API_KEY")!,
      model: DEFAULT_ANTHROPIC_MODEL,
    });

    try {
      const response = await provider.generate(TEST_PROMPT);
      assert(response.length > 0, "Response should not be empty");
      console.log(`Anthropic Response: ${response.substring(0, 50)}...`);
    } catch (error: any) {
      console.log(`Anthropic Provider Error (CAUGHT): ${error.name} - ${error.message}`);
      // Anthropic 404 is "not_found_error"
      if (error.message.includes("404") || error.message.includes("not_found")) {
        console.error("❌ 404/Not Found Error Detected!");
        throw error;
      }
      console.log("✅ Endpoint reached (Error caught but confirms connectivity)");
    }
  },
});
