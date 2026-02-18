/**
 * @module ProviderUtils
 * @path src/ai/provider_common_utils.ts
 * @description Shared utilities for AI providers, including token mapping, cost calculation, response handling, and retry logic.
 * @architectural-layer AI
 * @dependencies [event_logger, common, providers, types, constants]
 * @related-files [src/ai/providers.ts]
 */
import { EventLogger } from "../services/event_logger.ts";
import { AuthenticationError, RateLimitError } from "./providers/common.ts";
import { ConnectionError, ModelProviderError } from "./providers.ts";
import type { ModelOptions } from "./types.ts";
import { DEFAULT_AI_RETRY_BACKOFF_BASE_MS, DEFAULT_AI_RETRY_MAX_ATTEMPTS } from "../config/constants.ts";
import { withRetry } from "./providers/common.ts";
import {
  COST_RATE_ANTHROPIC,
  COST_RATE_GOOGLE,
  COST_RATE_MOCK,
  COST_RATE_OLLAMA,
  COST_RATE_OPENAI,
  TOKENS_PER_COST_UNIT,
} from "../config/constants.ts";
import { HTTP_FORBIDDEN, HTTP_TOO_MANY_REQUESTS, HTTP_UNAUTHORIZED } from "../constants.ts";
import {
  PROVIDER_ANTHROPIC,
  PROVIDER_GOOGLE,
  PROVIDER_MOCK,
  PROVIDER_OLLAMA,
  PROVIDER_OPENAI,
} from "../config/constants.ts";

export type TokenMap = {
  prompt_tokens?: number;
  completion_tokens?: number;
  total_tokens?: number;
  model?: string;
  cost_usd?: number;
  provider?: string;
};

/**
 * Calculate cost for token usage based on provider
 */
function calculateCost(provider: string, totalTokens: number): number {
  const rates: Record<string, number> = {
    [PROVIDER_OPENAI]: COST_RATE_OPENAI,
    [PROVIDER_ANTHROPIC]: COST_RATE_ANTHROPIC,
    [PROVIDER_GOOGLE]: COST_RATE_GOOGLE,
    [PROVIDER_OLLAMA]: COST_RATE_OLLAMA,
    [PROVIDER_MOCK]: COST_RATE_MOCK,
  };

  // Extract provider name from id (e.g., "google-gemini-2.0-flash-exp" -> "google")
  const providerKey = provider.split("-")[0].toLowerCase(); // This assumes provider constants are lowercase strings
  const rate = rates[providerKey] ?? 0;
  return rate * (totalTokens / TOKENS_PER_COST_UNIT);
}

export async function handleProviderResponse(
  response: Response,
  id: string,
  logger?: EventLogger,
  tokenMapper?: (data: any, providerId?: string) => TokenMap | undefined,
): Promise<any> {
  if (!response.ok) {
    // Include HTTP status code in messages so tests can assert on it (e.g. "HTTP 503").
    let message = `HTTP ${response.status} ${response.statusText}`;
    try {
      const error = await response.json();
      const remoteMsg = error.error?.message ?? error.message ?? undefined;
      if (remoteMsg) {
        message = `HTTP ${response.status} ${remoteMsg}`;
      }
    } catch {
      // ignore JSON parse errors and fallback to statusText
    }
    if (response.status === HTTP_UNAUTHORIZED || response.status === HTTP_FORBIDDEN) {
      throw new AuthenticationError(id, message);
    }
    if (response.status === HTTP_TOO_MANY_REQUESTS) {
      throw new RateLimitError(id, message);
    }
    if (response.status >= 500) {
      // Treat server (5xx) responses as connection-level failures
      throw new ConnectionError(id, message);
    }
    throw new ModelProviderError(message, id);
  }

  const data = await response.json();

  if (logger && tokenMapper) {
    try {
      const tokens = tokenMapper(data, id);
      if (tokens) {
        const inputTokens = tokens.prompt_tokens ?? 0;
        const outputTokens = tokens.completion_tokens ?? 0;
        const totalTokens = tokens.total_tokens ?? inputTokens + outputTokens;
        await logger.info("llm.usage", id, {
          ...tokens,
          provider: tokens.provider ?? id,
          input_tokens: inputTokens,
          output_tokens: outputTokens,
          total_tokens: totalTokens,
        });
      }
    } catch {
      // never fail the provider call because token logging failed
    }
  }

  return data;
}

/** Token mapper for OpenAI response shape */
export function tokenMapperOpenAI(model: string) {
  return (d: any, providerId?: string): TokenMap | undefined => {
    if (!d.usage) return undefined;

    const totalTokens = d.usage.total_tokens ?? (d.usage.prompt_tokens + d.usage.completion_tokens);
    const cost = providerId ? calculateCost(providerId, totalTokens) : undefined;

    return {
      prompt_tokens: d.usage.prompt_tokens,
      completion_tokens: d.usage.completion_tokens,
      total_tokens: totalTokens,
      model,
      cost_usd: cost,
    };
  };
}

/** Extract textual content from OpenAI response */
export function extractOpenAIContent(d: any): string {
  return d.choices?.[0]?.message?.content ?? "";
}

export function createOpenAIChatCompletionsRequestInit(
  apiKey: string,
  model: string,
  prompt: string,
  options?: ModelOptions,
): RequestInit {
  return {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [{ role: "user", content: prompt }],
      max_tokens: options?.max_tokens,
      temperature: options?.temperature,
      top_p: options?.top_p,
      stop: options?.stop,
    }),
  };
}

/** Token mapper for Google response shape */
export function tokenMapperGoogle(model: string) {
  return (d: any, providerId?: string): TokenMap | undefined => {
    if (!d.usageMetadata) return undefined;

    const totalTokens = d.usageMetadata.totalTokenCount ??
      (d.usageMetadata.promptTokenCount + d.usageMetadata.candidatesTokenCount);
    const cost = providerId ? calculateCost(providerId, totalTokens) : undefined;

    return {
      prompt_tokens: d.usageMetadata.promptTokenCount,
      completion_tokens: d.usageMetadata.candidatesTokenCount,
      total_tokens: totalTokens,
      model,
      cost_usd: cost,
    };
  };
}

/** Extract textual content from Google response */
export function extractGoogleContent(d: any): string {
  return d.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
}

/** Token mapper for Anthropic response shape */
export function tokenMapperAnthropic(model: string) {
  return (d: any, providerId?: string): TokenMap | undefined => {
    if (!d.usage) return undefined;

    const totalTokens = (d.usage.input_tokens ?? 0) + (d.usage.output_tokens ?? 0);
    const cost = providerId ? calculateCost(providerId, totalTokens) : undefined;

    return {
      prompt_tokens: d.usage.input_tokens,
      completion_tokens: d.usage.output_tokens,
      total_tokens: totalTokens,
      model,
      cost_usd: cost,
    };
  };
}

/** Extract textual content from Anthropic response */
export function extractAnthropicContent(d: any): string {
  return d.content?.[0]?.text ?? "";
}

/**
 * Perform fetch with retries/backoff and timeout, and handle provider responses.
 * Centralizes abort handling, retry/backoff, and ensures bodies are consumed.
 */
export async function fetchJsonWithRetries(
  url: string,
  fetchOptions: RequestInit,
  {
    id,
    maxAttempts = DEFAULT_AI_RETRY_MAX_ATTEMPTS,
    backoffBaseMs = DEFAULT_AI_RETRY_BACKOFF_BASE_MS,
    timeoutMs,
    logger,
    tokenMapper,
  }: {
    id: string;
    maxAttempts?: number;
    backoffBaseMs?: number;
    timeoutMs?: number;
    logger?: EventLogger;
    tokenMapper?: (d: any, providerId?: string) => TokenMap | undefined;
  },
): Promise<any> {
  // Use the withRetry helper to centralize retry/backoff semantics
  const attemptFn = async () => {
    const controller = typeof timeoutMs === "number" ? new AbortController() : undefined;
    const signal = controller?.signal;
    const timeoutId = controller && typeof timeoutMs === "number"
      ? setTimeout(() => controller.abort(), timeoutMs)
      : undefined;

    try {
      const response = await fetch(url, { ...fetchOptions, signal });
      // Let handleProviderResponse inspect status, parse JSON and throw typed errors
      const data = await handleProviderResponse(response, id, logger, tokenMapper);
      if (timeoutId) clearTimeout(timeoutId);
      return data;
    } catch (err) {
      if (timeoutId) clearTimeout(timeoutId);
      // Rethrow to allow withRetry to decide whether to retry
      throw err;
    }
  };

  // Use withRetry defined in providers/common.ts
  return await withRetry(attemptFn, { maxRetries: maxAttempts, baseDelayMs: backoffBaseMs });
}

/**
 * Perform a provider call: fetch JSON with retries, then extract textual content using the provided extractor.
 * This centralizes the common provider pattern: fetch -> handleProviderResponse -> extract content.
 */
export async function performProviderCall(
  url: string,
  fetchOptions: RequestInit,
  {
    id,
    maxAttempts = DEFAULT_AI_RETRY_MAX_ATTEMPTS,
    backoffBaseMs = DEFAULT_AI_RETRY_BACKOFF_BASE_MS,
    timeoutMs,
    logger,
    tokenMapper,
    extractor,
  }: {
    id: string;
    maxAttempts?: number;
    backoffBaseMs?: number;
    timeoutMs?: number;
    logger?: EventLogger;
    tokenMapper?: (d: any, providerId?: string) => TokenMap | undefined;
    extractor?: (d: any) => string;
  },
): Promise<string> {
  const data = await fetchJsonWithRetries(url, fetchOptions, {
    id,
    maxAttempts,
    backoffBaseMs,
    timeoutMs,
    logger,
    tokenMapper,
  });
  const content = extractor
    ? extractor(data)
    : (data?.choices?.[0]?.message?.content ?? data?.choices?.[0]?.text ?? "");
  return content ?? "";
}
