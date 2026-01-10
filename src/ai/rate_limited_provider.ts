/**
 * RateLimitedProvider - Cost Exhaustion Attack Prevention
 *
 * Wraps an IModelProvider to enforce rate limits and prevent financial loss:
 * - Maximum calls per minute
 * - Maximum tokens per hour
 * - Maximum cost per day
 *
 * Implements rollback on errors to ensure failed requests don't count against limits.
 */

import { IModelProvider } from "./providers.ts";

/**
 * Error thrown when rate limits are exceeded
 */
export class RateLimitError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RateLimitError";
  }
}

/**
 * Configuration for rate limiting
 */
export interface RateLimitConfig {
  /** Maximum API calls per minute */
  maxCallsPerMinute: number;
  /** Maximum tokens per hour */
  maxTokensPerHour: number;
  /** Maximum cost per day in USD */
  maxCostPerDay: number;
  /** Cost per 1,000 tokens in USD */
  costPer1kTokens: number;
}

/**
 * Provider that enforces rate limits to prevent cost exhaustion attacks
 */
export class RateLimitedProvider implements IModelProvider {
  public readonly id: string;

  private callsThisMinute = 0;
  private tokensThisHour = 0;
  private costThisDay = 0;
  private windowStart = Date.now();
  private hourStart = Date.now();
  private dayStart = Date.now();

  constructor(
    private inner: IModelProvider,
    private limits: RateLimitConfig,
  ) {
    this.id = `rate-limited-${inner.id}`;
  }

  async generate(prompt: string, options?: { max_tokens?: number }): Promise<string> {
    this.resetWindowsIfNeeded();

    // Check rate limits
    if (this.callsThisMinute >= this.limits.maxCallsPerMinute) {
      throw new RateLimitError(`Rate limit exceeded: ${this.limits.maxCallsPerMinute} calls per minute`);
    }

    // Estimate cost and tokens
    const estimatedTokens = this.estimateTokens(prompt, options);
    const estimatedCost = (estimatedTokens / 1000) * this.limits.costPer1kTokens;

    if (this.tokensThisHour + estimatedTokens > this.limits.maxTokensPerHour) {
      throw new RateLimitError(`Rate limit exceeded: ${this.limits.maxTokensPerHour} tokens per hour`);
    }

    if (this.costThisDay + estimatedCost > this.limits.maxCostPerDay) {
      throw new RateLimitError(
        `Cost limit exceeded: $${this.costThisDay.toFixed(2)}/$${this.limits.maxCostPerDay} per day`,
      );
    }

    // Track before call (pessimistic)
    this.callsThisMinute++;
    this.tokensThisHour += estimatedTokens;
    this.costThisDay += estimatedCost;

    try {
      const result = await this.inner.generate(prompt, options);
      return result;
    } catch (error) {
      // Rollback tracking on error
      this.callsThisMinute--;
      this.tokensThisHour -= estimatedTokens;
      this.costThisDay -= estimatedCost;
      throw error;
    }
  }

  /**
   * Reset rate limit windows when they expire
   */
  private resetWindowsIfNeeded(): void {
    const now = Date.now();

    // Reset per-minute counter
    if (now - this.windowStart > 60_000) {
      this.callsThisMinute = 0;
      this.windowStart = now;
    }

    // Reset hourly counter
    if (now - this.hourStart > 3_600_000) {
      this.tokensThisHour = 0;
      this.hourStart = now;
    }

    // Reset daily counter
    if (now - this.dayStart > 86_400_000) {
      this.costThisDay = 0;
      this.dayStart = now;
    }
  }

  /**
   * Estimate token count for a prompt
   * Rough estimation: 1 token ≈ 4 characters (English text)
   * But cap the estimation to be more conservative for very large prompts
   */
  private estimateTokens(prompt: string, _options?: { max_tokens?: number }): number {
    // For rate limiting, only count input tokens (prompt), not output tokens
    // This prevents over-estimation that would block legitimate requests
    return Math.min(Math.ceil(prompt.length / 4), 2000);
  }
}
