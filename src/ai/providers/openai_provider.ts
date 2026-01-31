import { ModelOptions } from "../providers.ts";
import { performProviderCall, tokenMapperOpenAI } from "../provider_common_utils.ts";
import * as DEFAULTS from "../../config/constants.ts";
import { BaseProvider, BaseProviderOptions } from "./base_provider.ts";

/**
 * Options for OpenAIProvider
 */
export type OpenAIProviderOptions = BaseProviderOptions;

/**
 * OpenAIProvider implements IModelProvider for OpenAI's GPT models.
 */
export class OpenAIProvider extends BaseProvider {
  /**
   * @param options.apiKey OpenAI API key
   * @param options.model Model name (default: gpt-4)
   * @param options.id Optional provider id
   * @param options.logger Optional event logger
   * @param options.retryDelayMs Optional retry delay in ms (reads from config)
   * @param options.maxRetries Optional max retries (reads from config)
   * @param options.baseUrl Optional base URL (reads from config)
   * @param options.config Optional config object for endpoints and retry settings
   */
  constructor(options: OpenAIProviderOptions) {
    super(
      options,
      DEFAULTS.DEFAULT_OPENAI_MODEL,
      options.config?.ai_endpoints?.openai || DEFAULTS.DEFAULT_OPENAI_ENDPOINT,
      options.config?.ai_timeout?.providers?.openai || DEFAULTS.DEFAULT_OPENAI_TIMEOUT_MS,
      options.config?.ai_retry?.providers?.openai?.backoff_base_ms || DEFAULTS.DEFAULT_OPENAI_RETRY_BACKOFF_MS,
      options.config?.ai_retry?.providers?.openai?.max_attempts || DEFAULTS.DEFAULT_OPENAI_RETRY_MAX_ATTEMPTS,
      "openai",
    );
  }

  /**
   * Internal: attempt a single completion call.
   */
  protected override async attemptGenerate(prompt: string, options?: ModelOptions): Promise<string> {
    const data = await performProviderCall(this.baseUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: this.model,
        messages: [{ role: "user", content: prompt }],
        max_tokens: options?.max_tokens,
        temperature: options?.temperature,
        top_p: options?.top_p,
        stop: options?.stop,
      }),
    }, {
      id: this.id,
      maxAttempts: this.maxRetries,
      backoffBaseMs: this.retryDelayMs,
      timeoutMs: this.timeoutMs,
      logger: this.logger,
      tokenMapper: tokenMapperOpenAI(this.model),
      extractor: (d: any) => d.choices?.[0]?.message?.content ?? "",
    });
    return data;
  }
}
