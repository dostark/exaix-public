/**
 * Tests for Provider Selector - Intelligent Provider Selection Strategy
 */

import { assertEquals, assertRejects } from "jsr:@std/assert@^1.0.0";
import { MockProviderFactory, ProviderRegistry } from "../../src/ai/provider_registry.ts";
import { CostTracker } from "../../src/services/cost_tracker.ts";
import { HealthCheckService } from "../../src/services/health_check_service.ts";
import { initTestDbService } from "../helpers/db.ts";

// ============================================================================
// Provider Selector Tests
// ============================================================================

Deno.test("ProviderSelector: selects optimal provider based on criteria", async () => {
  const { db, cleanup } = await initTestDbService();
  try {
    ProviderRegistry.clear();

    // Register test providers with different characteristics
    ProviderRegistry.registerWithMetadata("free-provider", new MockProviderFactory(), {
      name: "free-provider",
      description: "Free provider",
      capabilities: ["chat"],
      costTier: "FREE",
      pricingTier: "local",
      strengths: ["general"],
    });

    ProviderRegistry.registerWithMetadata("paid-provider", new MockProviderFactory(), {
      name: "paid-provider",
      description: "Paid provider",
      capabilities: ["chat"],
      costTier: "PAID",
      pricingTier: "high",
      strengths: ["complex"],
    });

    const costTracker = new CostTracker(db);
    const healthService = new HealthCheckService("1.0.0");

    // Mock health check to return healthy for both providers
    healthService.registerCheck({
      name: "free-provider",
      critical: false,
      check: async () => await ({ status: "pass" }),
    });
    healthService.registerCheck({
      name: "paid-provider",
      critical: false,
      check: async () => await ({ status: "pass" }),
    });

    // Import and create selector (will implement this)
    const { ProviderSelector } = await import("../../src/ai/provider_selector.ts");
    const selector = new ProviderSelector(ProviderRegistry, costTracker, healthService);

    const provider = await selector.selectProvider({
      preferFree: true,
      requiredCapabilities: ["chat"],
    });

    assertEquals(provider, "free-provider");
  } finally {
    await cleanup();
  }
});

Deno.test("ProviderSelector: throws error when no suitable provider found", async () => {
  const { db, cleanup } = await initTestDbService();
  try {
    ProviderRegistry.clear();

    const costTracker = new CostTracker(db);
    const healthService = new HealthCheckService("1.0.0");

    const { ProviderSelector } = await import("../../src/ai/provider_selector.ts");
    const selector = new ProviderSelector(ProviderRegistry, costTracker, healthService);

    await assertRejects(
      async () => {
        await selector.selectProvider({
          preferFree: true,
          requiredCapabilities: ["vision"], // No providers support vision
        });
      },
      Error,
      "No suitable provider found for criteria",
    );
  } finally {
    await cleanup();
  }
});

Deno.test("ProviderSelector: respects budget constraints", async () => {
  const { db, cleanup } = await initTestDbService();
  try {
    ProviderRegistry.clear();

    // Register providers
    ProviderRegistry.registerWithMetadata("cheap-provider", new MockProviderFactory(), {
      name: "cheap-provider",
      description: "Cheap provider",
      capabilities: ["chat"],
      costTier: "PAID",
      pricingTier: "low",
      strengths: ["general"],
    });

    ProviderRegistry.registerWithMetadata("expensive-provider", new MockProviderFactory(), {
      name: "expensive-provider",
      description: "Expensive provider",
      capabilities: ["chat"],
      costTier: "PAID",
      pricingTier: "high",
      strengths: ["general"],
    });

    const costTracker = new CostTracker(db);
    const healthService = new HealthCheckService("1.0.0");

    // Set up high cost for expensive provider
    await costTracker.trackRequest("expensive-provider", 100000); // ~$1

    // Mock health checks
    healthService.registerCheck({
      name: "cheap-provider",
      critical: false,
      check: async () => await ({ status: "pass" }),
    });
    healthService.registerCheck({
      name: "expensive-provider",
      critical: false,
      check: async () => await ({ status: "pass" }),
    });

    const { ProviderSelector } = await import("../../src/ai/provider_selector.ts");
    const selector = new ProviderSelector(ProviderRegistry, costTracker, healthService);

    const provider = await selector.selectProvider({
      maxCostUsd: 0.5, // Budget too low for expensive provider
      requiredCapabilities: ["chat"],
    });

    assertEquals(provider, "cheap-provider");
  } finally {
    await cleanup();
  }
});

Deno.test("ProviderSelector: routes tasks by complexity", async () => {
  const { db, tempDir: _tempDir, cleanup } = await initTestDbService();
  try {
    ProviderRegistry.clear();

    // Register providers with different pricing tiers
    ProviderRegistry.registerWithMetadata("local-provider", new MockProviderFactory(), {
      name: "local-provider",
      description: "Local provider",
      capabilities: ["chat"],
      costTier: "FREE",
      pricingTier: "local",
      strengths: ["simple"],
    });

    ProviderRegistry.registerWithMetadata("premium-provider", new MockProviderFactory(), {
      name: "premium-provider",
      description: "Premium provider",
      capabilities: ["chat"],
      costTier: "PAID",
      pricingTier: "high",
      strengths: ["complex"],
    });

    const costTracker = new CostTracker(db);
    const healthService = new HealthCheckService("1.0.0");

    // Mock health checks
    healthService.registerCheck({
      name: "local-provider",
      critical: false,
      check: async () => await ({ status: "pass" }),
    });
    healthService.registerCheck({
      name: "premium-provider",
      critical: false,
      check: async () => await ({ status: "pass" }),
    });

    const { ProviderSelector } = await import("../../src/ai/provider_selector.ts");
    const selector = new ProviderSelector(ProviderRegistry, costTracker, healthService);

    // Simple task should prefer local provider
    const simpleProvider = await selector.selectProvider({
      taskComplexity: "simple",
      requiredCapabilities: ["chat"],
    });
    assertEquals(simpleProvider, "local-provider");

    // Complex task should prefer premium provider
    const complexProvider = await selector.selectProvider({
      taskComplexity: "complex",
      requiredCapabilities: ["chat"],
    });
    assertEquals(complexProvider, "premium-provider");
  } finally {
    await cleanup();
  }
});

Deno.test("ProviderSelector: filters by required capabilities", async () => {
  const { db, tempDir: _tempDir, cleanup } = await initTestDbService();
  try {
    ProviderRegistry.clear();

    // Register providers with different capabilities
    ProviderRegistry.registerWithMetadata("chat-provider", new MockProviderFactory(), {
      name: "chat-provider",
      description: "Chat provider",
      capabilities: ["chat"],
      costTier: "FREE",
      pricingTier: "local",
      strengths: ["general"],
    });

    ProviderRegistry.registerWithMetadata("vision-provider", new MockProviderFactory(), {
      name: "vision-provider",
      description: "Vision provider",
      capabilities: ["chat", "vision"],
      costTier: "PAID",
      pricingTier: "high",
      strengths: ["general"],
    });

    const costTracker = new CostTracker(db);
    const healthService = new HealthCheckService("1.0.0");

    // Mock health checks
    healthService.registerCheck({
      name: "chat-provider",
      critical: false,
      check: async () => await ({ status: "pass" }),
    });
    healthService.registerCheck({
      name: "vision-provider",
      critical: false,
      check: async () => await ({ status: "pass" }),
    });

    const { ProviderSelector } = await import("../../src/ai/provider_selector.ts");
    const selector = new ProviderSelector(ProviderRegistry, costTracker, healthService);

    // Request vision capability should select vision provider
    const provider = await selector.selectProvider({
      requiredCapabilities: ["vision"],
    });
    assertEquals(provider, "vision-provider");
  } finally {
    await cleanup();
  }
});

Deno.test("ProviderSelector: excludes unhealthy providers", async () => {
  const { db, tempDir: _tempDir, cleanup } = await initTestDbService();
  try {
    ProviderRegistry.clear();

    // Register providers
    ProviderRegistry.registerWithMetadata("healthy-provider", new MockProviderFactory(), {
      name: "healthy-provider",
      description: "Healthy provider",
      capabilities: ["chat"],
      costTier: "FREE",
      pricingTier: "local",
      strengths: ["general"],
    });

    ProviderRegistry.registerWithMetadata("unhealthy-provider", new MockProviderFactory(), {
      name: "unhealthy-provider",
      description: "Unhealthy provider",
      capabilities: ["chat"],
      costTier: "PAID",
      pricingTier: "high",
      strengths: ["general"],
    });

    const costTracker = new CostTracker(db);
    const healthService = new HealthCheckService("1.0.0");

    // Mock health checks - unhealthy provider fails
    healthService.registerCheck({
      name: "healthy-provider",
      critical: false,
      check: async () => await ({ status: "pass" }),
    });
    healthService.registerCheck({
      name: "unhealthy-provider",
      critical: false,
      check: async () => await ({ status: "fail" }),
    });

    const { ProviderSelector } = await import("../../src/ai/provider_selector.ts");
    const selector = new ProviderSelector(ProviderRegistry, costTracker, healthService);

    const provider = await selector.selectProvider({
      requiredCapabilities: ["chat"],
    });

    assertEquals(provider, "healthy-provider");
  } finally {
    await cleanup();
  }
});
