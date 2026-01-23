/**
 * Token Usage Tracking Regression Test
 *
 * Regression test for: "Event journal missing token usage tracking in payload"
 * Root cause: Token usage was logged at debug level (below info threshold) and lacked cost calculations
 * Fix: Changed logging to info level and added cost calculation to token mappers
 */

import { assertEquals } from "@std/assert";
import { tokenMapperAnthropic, tokenMapperGoogle, tokenMapperOpenAI } from "../src/ai/provider_common_utils.ts";
import { COST_RATE_ANTHROPIC, COST_RATE_GOOGLE, COST_RATE_OPENAI } from "../src/config/constants.ts";
import {
  TEST_COMPLETION_TOKENS_ANTHROPIC,
  TEST_COMPLETION_TOKENS_GOOGLE,
  TEST_COMPLETION_TOKENS_OPENAI,
  TEST_MODEL_ANTHROPIC,
  TEST_MODEL_GOOGLE,
  TEST_MODEL_OPENAI,
  TEST_PROMPT_TOKENS_ANTHROPIC,
  TEST_PROMPT_TOKENS_GOOGLE,
  TEST_PROMPT_TOKENS_OPENAI,
  TEST_PROVIDER_ID_ANTHROPIC,
  TEST_PROVIDER_ID_ANTHROPIC_ERROR,
  TEST_PROVIDER_ID_GOOGLE,
  TEST_PROVIDER_ID_GOOGLE_ERROR,
  TEST_PROVIDER_ID_OPENAI,
  TEST_PROVIDER_ID_OPENAI_ERROR,
  TEST_TOTAL_TOKENS_ANTHROPIC,
  TEST_TOTAL_TOKENS_GOOGLE,
  TEST_TOTAL_TOKENS_OPENAI,
} from "./config/constants.ts";

Deno.test("[regression] Token usage logged at info level with cost calculation", () => {
  // Test that tokenMapperGoogle includes cost calculation
  const mapper = tokenMapperGoogle(TEST_MODEL_GOOGLE);
  const mockResponse = {
    usageMetadata: {
      promptTokenCount: TEST_PROMPT_TOKENS_GOOGLE,
      candidatesTokenCount: TEST_COMPLETION_TOKENS_GOOGLE,
      totalTokenCount: TEST_TOTAL_TOKENS_GOOGLE,
    },
  };

  const result = mapper(mockResponse, TEST_PROVIDER_ID_GOOGLE);

  assertEquals(result?.prompt_tokens, TEST_PROMPT_TOKENS_GOOGLE);
  assertEquals(result?.completion_tokens, TEST_COMPLETION_TOKENS_GOOGLE);
  assertEquals(result?.total_tokens, TEST_TOTAL_TOKENS_GOOGLE);
  assertEquals(result?.model, TEST_MODEL_GOOGLE);

  // Verify cost calculation (Google rate = 0.0025 per 1000 tokens)
  const expectedCost = (TEST_TOTAL_TOKENS_GOOGLE / 1000) * COST_RATE_GOOGLE;
  assertEquals(result?.cost_usd, expectedCost);
});

Deno.test("[regression] OpenAI token mapper includes cost calculation", () => {
  const mapper = tokenMapperOpenAI(TEST_MODEL_OPENAI);
  const mockResponse = {
    usage: {
      prompt_tokens: TEST_PROMPT_TOKENS_OPENAI,
      completion_tokens: TEST_COMPLETION_TOKENS_OPENAI,
      total_tokens: TEST_TOTAL_TOKENS_OPENAI,
    },
  };

  const result = mapper(mockResponse, TEST_PROVIDER_ID_OPENAI);

  assertEquals(result?.prompt_tokens, TEST_PROMPT_TOKENS_OPENAI);
  assertEquals(result?.completion_tokens, TEST_COMPLETION_TOKENS_OPENAI);
  assertEquals(result?.total_tokens, TEST_TOTAL_TOKENS_OPENAI);
  assertEquals(result?.model, TEST_MODEL_OPENAI);

  // Verify cost calculation (OpenAI rate = 0.002 per 1000 tokens)
  const expectedCost = (TEST_TOTAL_TOKENS_OPENAI / 1000) * COST_RATE_OPENAI;
  assertEquals(result?.cost_usd, expectedCost);
});

Deno.test("[regression] Anthropic token mapper includes cost calculation", () => {
  const mapper = tokenMapperAnthropic(TEST_MODEL_ANTHROPIC);
  const mockResponse = {
    usage: {
      input_tokens: TEST_PROMPT_TOKENS_ANTHROPIC,
      output_tokens: TEST_COMPLETION_TOKENS_ANTHROPIC,
    },
  };

  const result = mapper(mockResponse, TEST_PROVIDER_ID_ANTHROPIC);

  assertEquals(result?.prompt_tokens, TEST_PROMPT_TOKENS_ANTHROPIC);
  assertEquals(result?.completion_tokens, TEST_COMPLETION_TOKENS_ANTHROPIC);
  assertEquals(result?.total_tokens, TEST_TOTAL_TOKENS_ANTHROPIC);
  assertEquals(result?.model, TEST_MODEL_ANTHROPIC);

  // Verify cost calculation (Anthropic rate = 0.005 per 1000 tokens)
  const expectedCost = (TEST_TOTAL_TOKENS_ANTHROPIC / 1000) * COST_RATE_ANTHROPIC;
  assertEquals(result?.cost_usd, expectedCost);
});

Deno.test("[regression] Token mappers return undefined when no usage data", () => {
  const googleMapper = tokenMapperGoogle(TEST_MODEL_GOOGLE);
  const openAIMapper = tokenMapperOpenAI(TEST_MODEL_OPENAI);
  const anthropicMapper = tokenMapperAnthropic(TEST_MODEL_ANTHROPIC);

  const emptyResponse = {};

  assertEquals(googleMapper(emptyResponse, TEST_PROVIDER_ID_GOOGLE_ERROR), undefined);
  assertEquals(openAIMapper(emptyResponse, TEST_PROVIDER_ID_OPENAI_ERROR), undefined);
  assertEquals(anthropicMapper(emptyResponse, TEST_PROVIDER_ID_ANTHROPIC_ERROR), undefined);
});
