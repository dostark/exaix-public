import { MockStrategy, ProviderType } from "../enums.ts";
import type { EventLogger } from "../services/event_logger.ts";

/**
 * Options for model generation requests.
 */
export interface ModelOptions {
  temperature?: number;
  max_tokens?: number;
  top_p?: number;
  stop?: string[];
  stream?: boolean;
}

/**
 * Standard interface that all model providers must implement.
 */
export interface IModelProvider {
  /** Unique identifier for this provider instance. */
  id: string;

  /**
   * Generate a response from the model.
   * @param prompt The input prompt to send to the model
   * @param options Optional generation parameters
   * @returns The generated text response
   */
  generate(prompt: string, options?: ModelOptions): Promise<string>;
}

/**
 * Resolved provider options after merging env vars and config
 */
export interface ResolvedProviderOptions {
  /** Provider type */
  provider: ProviderType;
  /** Model name */
  model: string;
  /** API base URL */
  baseUrl?: string;
  /** Timeout in milliseconds */
  timeoutMs: number;
  /** API key (for cloud providers) */
  apiKey?: string;
  /** Mock strategy */
  mockStrategy?: MockStrategy;
  /** Mock fixtures directory */
  mockFixturesDir?: string;
  /** Custom provider ID */
  id?: string;
  /** Responses for scripted mock */
  responses?: string[];
  /** Optional event logger for usage tracking */
  logger?: EventLogger;
}

/**
 * Provider information for logging/debugging
 */
export interface ProviderInfo {
  /** Provider type */
  type: ProviderType;
  /** Provider ID */
  id: string;
  /** Model name */
  model: string;
  /** Source of configuration */
  source: "env" | "config" | "default";
}
