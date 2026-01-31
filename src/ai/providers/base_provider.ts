import { IModelProvider, ModelOptions } from "../providers.ts";
import { EventLogger } from "../../services/event_logger.ts";
import { withRetry } from "./common.ts";
import type { Config } from "../../config/schema.ts";

/**
 * Common options for all providers
 */
export interface BaseProviderOptions {
  apiKey: string;
  model?: string;
  id?: string;
  logger?: EventLogger;
  retryDelayMs?: number;
  maxRetries?: number;
  baseUrl?: string;
  config?: Config;
  timeoutMs?: number;
}

/**
 * BaseProvider implements common logic for LLM providers.
 */
export abstract class BaseProvider implements IModelProvider {
  public readonly id: string;
  protected readonly apiKey: string;
  protected readonly model: string;
  protected readonly baseUrl: string;
  protected readonly logger?: EventLogger;
  protected readonly retryDelayMs: number;
  protected readonly maxRetries: number;
  protected readonly timeoutMs: number;

  constructor(
    options: BaseProviderOptions,
    defaultModel: string,
    defaultEndpoint: string,
    defaultTimeout: number,
    defaultRetryDelay: number,
    defaultMaxRetries: number,
    idPrefix: string,
  ) {
    this.apiKey = options.apiKey;
    this.model = options.model || defaultModel;
    this.id = options.id || `${idPrefix}-${this.model}`;
    this.logger = options.logger;
    this.baseUrl = options.baseUrl || defaultEndpoint;
    this.retryDelayMs = options.retryDelayMs || defaultRetryDelay;
    this.maxRetries = options.maxRetries || defaultMaxRetries;
    this.timeoutMs = options.timeoutMs || defaultTimeout;
  }

  /**
   * Generate a completion from the model.
   */
  async generate(prompt: string, options?: ModelOptions): Promise<string> {
    return await withRetry(
      () => this.attemptGenerate(prompt, options),
      { maxRetries: this.maxRetries, baseDelayMs: this.retryDelayMs },
    );
  }

  /**
   * Internal: attempt a single completion call.
   */
  protected abstract attemptGenerate(prompt: string, options?: ModelOptions): Promise<string>;
}
