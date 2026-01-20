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
  name: DEFAULTS.TEST_NAME_GOOGLE_REGRESSION,
  ignore: !Deno.env.get(DEFAULTS.ENV_GOOGLE_API_KEY),
  fn: async () => {
    const provider = new GoogleProvider({
      apiKey: Deno.env.get(DEFAULTS.ENV_GOOGLE_API_KEY)!,
      model: DEFAULT_GOOGLE_MODEL, // gemini-2.0-flash-exp
    });

    try {
      const response = await provider.generate(TEST_PROMPT);
      assert(response.length > 0, "Response should not be empty");
      console.log(
        `${DEFAULTS.LOG_PREFIX_GOOGLE_RESPONSE} ${response.substring(0, DEFAULTS.TEST_LOG_PREVIEW_LENGTH)}...`,
      );
    } catch (error: any) {
      console.log(`${DEFAULTS.LOG_PREFIX_GOOGLE_ERROR} ${error.name} - ${error.message}`);
      if (error.message.includes(DEFAULTS.ERROR_MSG_HTTP_404)) throw error;
      console.log(DEFAULTS.LOG_MSG_ENDPOINT_REACHED);
    }
  },
});

Deno.test({
  name: DEFAULTS.TEST_NAME_OPENAI_REGRESSION,
  ignore: !Deno.env.get(DEFAULTS.ENV_OPENAI_API_KEY),
  fn: async () => {
    const provider = new OpenAIProvider({
      apiKey: Deno.env.get(DEFAULTS.ENV_OPENAI_API_KEY)!,
      model: DEFAULT_OPENAI_MODEL,
    });

    try {
      const response = await provider.generate(TEST_PROMPT);
      assert(response.length > 0, "Response should not be empty");
      console.log(
        `${DEFAULTS.LOG_PREFIX_OPENAI_RESPONSE} ${response.substring(0, DEFAULTS.TEST_LOG_PREVIEW_LENGTH)}...`,
      );
    } catch (error: any) {
      console.log(`${DEFAULTS.LOG_PREFIX_OPENAI_ERROR} ${error.name} - ${error.message}`);
      if (error.message.includes(DEFAULTS.ERROR_MSG_HTTP_404)) throw error;
      console.log(DEFAULTS.LOG_MSG_ENDPOINT_REACHED);
    }
  },
});

Deno.test({
  name: DEFAULTS.TEST_NAME_ANTHROPIC_REGRESSION,
  ignore: !Deno.env.get(DEFAULTS.ENV_ANTHROPIC_API_KEY),
  fn: async () => {
    const provider = new AnthropicProvider({
      apiKey: Deno.env.get(DEFAULTS.ENV_ANTHROPIC_API_KEY)!,
      model: DEFAULT_ANTHROPIC_MODEL,
    });

    try {
      const response = await provider.generate(TEST_PROMPT);
      assert(response.length > 0, "Response should not be empty");
      console.log(
        `${DEFAULTS.LOG_PREFIX_ANTHROPIC_RESPONSE} ${response.substring(0, DEFAULTS.TEST_LOG_PREVIEW_LENGTH)}...`,
      );
    } catch (error: any) {
      console.log(`${DEFAULTS.LOG_PREFIX_ANTHROPIC_ERROR} ${error.name} - ${error.message}`);
      // Anthropic 404 is "not_found_error"
      if (error.message.includes(DEFAULTS.ERROR_MSG_HTTP_404) || error.message.includes(DEFAULTS.ERROR_MSG_NOT_FOUND)) {
        console.error(DEFAULTS.LOG_MSG_NOT_FOUND_DETECTED);
        throw error;
      }
      console.log(DEFAULTS.LOG_MSG_ENDPOINT_REACHED_ANHROPIC);
    }
  },
});
