/**
 * Provider Selector - Intelligent Provider Selection Strategy
 *
 * Implements intelligent selection of LLM providers based on:
 * - Cost preferences (free vs paid)
 * - Task complexity (simple vs complex)
 * - Budget constraints
 * - Required capabilities
 * - Provider health status
 */

import { ProviderRegistry } from "./provider_registry.ts";
import { CostTracker } from "../services/cost_tracker.ts";
import { HealthCheckService } from "../services/health_check_service.ts";
import { Config } from "../config/schema.ts";

/**
 * Criteria for selecting a provider
 */
export interface SelectionCriteria {
  /** Prefer free providers when available */
  preferFree?: boolean;
  /** Maximum daily cost in USD */
  maxCostUsd?: number;
  /** Task complexity level */
  taskComplexity?: "simple" | "medium" | "complex";
  /** Required provider capabilities */
  requiredCapabilities?: string[];
  /** Allow local providers */
  allowLocal?: boolean;
}

/**
 * Intelligent provider selector that chooses the optimal LLM provider
 * based on cost, capabilities, health, and task requirements.
 */
export class ProviderSelector {
  constructor(
    private registry: typeof ProviderRegistry,
    private costTracker: CostTracker,
    private healthChecker: HealthCheckService,
  ) {}

  /**
   * Select the optimal provider based on the given criteria.
   * @param criteria Selection criteria
   * @returns The name of the selected provider
   * @throws Error if no suitable provider is found
   */
  async selectProvider(criteria: SelectionCriteria): Promise<string> {
    let candidates = this.registry.getAllProviders();

    // Filter by capabilities
    if (criteria.requiredCapabilities) {
      candidates = candidates.filter((p) =>
        criteria.requiredCapabilities!.every((cap) => p.metadata.capabilities.includes(cap))
      );
    }

    // Filter by cost preference
    if (criteria.preferFree) {
      const freeProviders = candidates.filter((p) =>
        p.metadata.costTier === "FREE" || p.metadata.costTier === "FREEMIUM"
      );
      if (freeProviders.length > 0) {
        candidates = freeProviders;
      }
    }

    // Filter by budget
    if (criteria.maxCostUsd) {
      candidates = await this.filterByBudget(candidates, criteria.maxCostUsd);
    }

    // Filter by health
    candidates = await this.filterByHealth(candidates);

    // Sort by task complexity match
    if (criteria.taskComplexity) {
      candidates = this.sortByTaskMatch(candidates, criteria.taskComplexity);
    }

    if (candidates.length === 0) {
      throw new Error("No suitable provider found for criteria");
    }

    return candidates[0].metadata.name;
  }

  /**
   * Select provider for a specific task using configuration-driven strategy.
   * @param config Configuration with provider strategy
   * @param taskType Task type (simple, complex, etc.)
   * @returns The name of the selected provider
   * @throws Error if no suitable provider is found
   */
  async selectProviderForTask(config: Config, taskType: string): Promise<string> {
    const strategy = config.provider_strategy;

    // Check if task routing is configured for this task type
    if (strategy.task_routing && strategy.task_routing[taskType]) {
      const routedProviders = strategy.task_routing[taskType];

      // Find the first healthy provider from the routing list
      for (const providerName of routedProviders) {
        const metadata = this.registry.getProviderMetadata(providerName);
        if (metadata) {
          const isHealthy = await this.healthChecker.checkProvider(providerName);
          if (isHealthy) {
            return providerName;
          }
        }
      }
    }

    // Fall back to criteria-based selection using config defaults
    const criteria: SelectionCriteria = {
      preferFree: strategy.prefer_free,
      maxCostUsd: strategy.max_daily_cost_usd,
      allowLocal: strategy.allow_local,
      requiredCapabilities: ["chat"], // Default capability requirement
    };

    // Map task type to complexity if it's a known type
    if (taskType === "simple" || taskType === "complex") {
      criteria.taskComplexity = taskType as "simple" | "complex";
    }

    return this.selectProvider(criteria);
  }

  /**
   * Filter providers by budget constraints.
   */
  private async filterByBudget(
    providers: Array<{ factory: any; metadata: any }>,
    maxCost: number,
  ): Promise<Array<{ factory: any; metadata: any }>> {
    const results = [];
    for (const p of providers) {
      const dailyCost = await this.costTracker.getDailyCost(p.metadata.name);
      if (dailyCost < maxCost) {
        results.push(p);
      }
    }
    return results;
  }

  /**
   * Filter providers by health status.
   */
  private async filterByHealth(
    providers: Array<{ factory: any; metadata: any }>,
  ): Promise<Array<{ factory: any; metadata: any }>> {
    const results = [];
    for (const p of providers) {
      const isHealthy = await this.healthChecker.checkProvider(p.metadata.name);
      if (isHealthy) {
        results.push(p);
      }
    }
    return results;
  }

  /**
   * Sort providers by task complexity match.
   */
  private sortByTaskMatch(
    providers: Array<{ factory: any; metadata: any }>,
    complexity: "simple" | "medium" | "complex",
  ): Array<{ factory: any; metadata: any }> {
    const tierPreference = {
      "simple": ["local", "free", "low"],
      "medium": ["low", "medium", "free"],
      "complex": ["high", "medium", "low"],
    };

    const preferred = tierPreference[complexity];
    return providers.sort((a, b) => {
      const aIndex = preferred.indexOf(a.metadata.pricingTier);
      const bIndex = preferred.indexOf(b.metadata.pricingTier);
      return (aIndex === -1 ? 999 : aIndex) - (bIndex === -1 ? 999 : bIndex);
    });
  }
}
