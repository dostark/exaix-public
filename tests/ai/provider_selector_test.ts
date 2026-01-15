/**
 * Tests for Provider Selector - Intelligent Provider Selection Strategy
 */

import { assertEquals, assertRejects } from "@std/assert";
import { EvaluationCategory, MCPTransport, ProviderCostTier } from "../../src/enums.ts";

import { HealthCheckVerdict } from "../../src/enums.ts";

import { MockProviderFactory, ProviderRegistry } from "../../src/ai/provider_registry.ts";
import { ProviderSelector } from "../../src/ai/provider_selector.ts";
import { CostTracker } from "../../src/services/cost_tracker.ts";
import { HealthCheckService } from "../../src/services/health_check_service.ts";
import { initTestDbService } from "../helpers/db.ts";
import { Config } from "../../src/config/schema.ts";
import { LogLevel, PricingTier, SqliteJournalMode, TaskComplexity } from "../../src/enums.ts";

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
      costTier: ProviderCostTier.FREE,
      pricingTier: PricingTier.LOCAL,
      strengths: ["general"],
    });

    ProviderRegistry.registerWithMetadata("paid-provider", new MockProviderFactory(), {
      name: "paid-provider",
      description: "Paid provider",
      capabilities: ["chat"],
      costTier: ProviderCostTier.PAID,
      pricingTier: PricingTier.HIGH,
      strengths: ["complex"],
    });

    const costTracker = new CostTracker(db);
    const healthService = new HealthCheckService("1.0.0");

    // Mock health check to return healthy for both providers
    healthService.registerCheck({
      name: "free-provider",
      critical: false,
      check: async () => await ({ status: HealthCheckVerdict.PASS }),
    });
    healthService.registerCheck({
      name: "paid-provider",
      critical: false,
      check: async () => await ({ status: HealthCheckVerdict.PASS }),
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
      costTier: ProviderCostTier.PAID,
      pricingTier: PricingTier.LOW,
      strengths: ["general"],
    });

    ProviderRegistry.registerWithMetadata("expensive-provider", new MockProviderFactory(), {
      name: "expensive-provider",
      description: "Expensive provider",
      capabilities: ["chat"],
      costTier: ProviderCostTier.PAID,
      pricingTier: PricingTier.HIGH,
      strengths: ["general"],
    });

    const costTracker = new CostTracker(db);
    const healthService = new HealthCheckService("1.0.0");

    // Set up high cost for expensive provider
    await costTracker.trackRequest("expensive-provider", 100000); // ~$1
    await costTracker.flush(); // Ensure the cost is written immediately for the test

    // Mock health checks
    healthService.registerCheck({
      name: "cheap-provider",
      critical: false,
      check: async () => await ({ status: HealthCheckVerdict.PASS }),
    });
    healthService.registerCheck({
      name: "expensive-provider",
      critical: false,
      check: async () => await ({ status: HealthCheckVerdict.PASS }),
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
      costTier: ProviderCostTier.FREE,
      pricingTier: PricingTier.LOCAL,
      strengths: ["simple"],
    });

    ProviderRegistry.registerWithMetadata("premium-provider", new MockProviderFactory(), {
      name: "premium-provider",
      description: "Premium provider",
      capabilities: ["chat"],
      costTier: ProviderCostTier.PAID,
      pricingTier: PricingTier.HIGH,
      strengths: ["complex"],
    });

    const costTracker = new CostTracker(db);
    const healthService = new HealthCheckService("1.0.0");

    // Mock health checks
    healthService.registerCheck({
      name: "local-provider",
      critical: false,
      check: async () => await ({ status: HealthCheckVerdict.PASS }),
    });
    healthService.registerCheck({
      name: "premium-provider",
      critical: false,
      check: async () => await ({ status: HealthCheckVerdict.PASS }),
    });

    const { ProviderSelector } = await import("../../src/ai/provider_selector.ts");
    const selector = new ProviderSelector(ProviderRegistry, costTracker, healthService);

    // Simple task should prefer local provider
    const simpleProvider = await selector.selectProvider({
      taskComplexity: TaskComplexity.SIMPLE,
      requiredCapabilities: ["chat"],
    });
    assertEquals(simpleProvider, "local-provider");

    // Complex task should prefer premium provider
    const complexProvider = await selector.selectProvider({
      taskComplexity: TaskComplexity.COMPLEX,
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
      costTier: ProviderCostTier.FREE,
      pricingTier: PricingTier.LOCAL,
      strengths: ["general"],
    });

    ProviderRegistry.registerWithMetadata("vision-provider", new MockProviderFactory(), {
      name: "vision-provider",
      description: "Vision provider",
      capabilities: ["chat", "vision"],
      costTier: ProviderCostTier.PAID,
      pricingTier: PricingTier.HIGH,
      strengths: ["general"],
    });

    const costTracker = new CostTracker(db);
    const healthService = new HealthCheckService("1.0.0");

    // Mock health checks
    healthService.registerCheck({
      name: "chat-provider",
      critical: false,
      check: async () => await ({ status: HealthCheckVerdict.PASS }),
    });
    healthService.registerCheck({
      name: "vision-provider",
      critical: false,
      check: async () => await ({ status: HealthCheckVerdict.PASS }),
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
      costTier: ProviderCostTier.FREE,
      pricingTier: PricingTier.LOCAL,
      strengths: ["general"],
    });

    ProviderRegistry.registerWithMetadata("unhealthy-provider", new MockProviderFactory(), {
      name: "unhealthy-provider",
      description: "Unhealthy provider",
      capabilities: ["chat"],
      costTier: ProviderCostTier.PAID,
      pricingTier: PricingTier.HIGH,
      strengths: ["general"],
    });

    const costTracker = new CostTracker(db);
    const healthService = new HealthCheckService("1.0.0");

    // Mock health checks - unhealthy provider fails
    healthService.registerCheck({
      name: "healthy-provider",
      critical: false,
      check: async () => await ({ status: HealthCheckVerdict.PASS }),
    });
    healthService.registerCheck({
      name: "unhealthy-provider",
      critical: false,
      check: async () => await ({ status: HealthCheckVerdict.FAIL }),
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

Deno.test("ProviderSelector: uses configuration for task routing", async () => {
  const { db, cleanup } = await initTestDbService();
  try {
    ProviderRegistry.clear();

    // Register providers with different capabilities
    ProviderRegistry.registerWithMetadata("simple-provider", new MockProviderFactory(), {
      name: "simple-provider",
      description: "Simple provider",
      capabilities: ["chat"],
      costTier: ProviderCostTier.FREE,
      pricingTier: PricingTier.LOCAL,
      strengths: ["general"],
    });

    ProviderRegistry.registerWithMetadata("complex-provider", new MockProviderFactory(), {
      name: "complex-provider",
      description: "Complex provider",
      capabilities: ["chat"],
      costTier: ProviderCostTier.PAID,
      pricingTier: PricingTier.HIGH,
      strengths: ["reasoning"],
    });

    const costTracker = new CostTracker(db);
    const healthService = new HealthCheckService("1.0.0");

    // Mock health checks
    healthService.registerCheck({
      name: "simple-provider",
      critical: false,
      check: async () => await ({ status: HealthCheckVerdict.PASS }),
    });
    healthService.registerCheck({
      name: "complex-provider",
      critical: false,
      check: async () => await ({ status: HealthCheckVerdict.PASS }),
    });

    const { ProviderSelector } = await import("../../src/ai/provider_selector.ts");

    // Create config with task routing
    const config: Config = {
      system: { version: "1.0.0", root: "/tmp", log_level: LogLevel.INFO },
      paths: {
        workspace: "Workspace",
        runtime: ".exo",
        memory: "Memory",
        portals: "Portals",
        blueprints: "Blueprints",
        active: "Active",
        archive: "Archive",
        plans: "Plans",
        requests: "Requests",
        rejected: "Rejected",
        agents: "Agents",
        flows: "Flows",
        memoryExecution: "Memory/Execution",
        memoryGlobal: "Memory/Global",
        memoryIndex: "Memory/Index",
        memoryPending: "Memory/Pending",
        memoryProjects: "Memory/Projects",
        memorySkills: "Memory/Skills",
        memoryTasks: "Memory/Tasks",
      },
      database: {
        batch_flush_ms: 100,
        batch_max_size: 100,
        sqlite: { journal_mode: SqliteJournalMode.WAL, foreign_keys: true, busy_timeout_ms: 5000 },
      },
      watcher: { debounce_ms: 200, stability_check: true },
      agents: { default_model: "default", timeout_sec: 60, max_iterations: 10 },
      portals: [],
      ai_endpoints: {},
      ai_retry: { max_attempts: 3, backoff_base_ms: 1000, timeout_per_request_ms: 30000 },
      ai_timeout: { default_ms: 30000, providers: { ollama: 60000, anthropic: 60000, openai: 30000, google: 30000 } },
      ai_anthropic: {
        api_version: "2023-06-01",
        default_model: "claude-3-5-sonnet-20241022",
        max_tokens_default: 4096,
      },
      mcp: { enabled: true, transport: MCPTransport.STDIO, server_name: "exoframe", version: "1.0.0" },
      mcp_defaults: { agent_id: "system" },
      rate_limiting: {
        enabled: true,
        max_calls_per_minute: 60,
        max_tokens_per_hour: 100000,
        max_cost_per_day: 50,
        cost_per_1k_tokens: 0.03,
      },
      git: {
        branch_prefix_pattern: "^(feat|fix|docs|chore|refactor|test)/",
        allowed_prefixes: ["feat", "fix", "docs", "chore", "refactor", "test"],
        operations: {
          status_timeout_ms: 10000,
          ls_files_timeout_ms: 5000,
          checkout_timeout_ms: 10000,
          clean_timeout_ms: 5000,
          log_timeout_ms: 5000,
          diff_timeout_ms: 10000,
          command_timeout_ms: 30000,
          max_retries: 3,
          retry_backoff_base_ms: 100,
          branch_name_collision_max_retries: 5,
          trace_id_short_length: 8,
          branch_suffix_length: 6,
        },
      },
      models: {
        default: { provider: "mock", model: "mock-model", timeout_ms: 30000 },
        fast: { provider: "mock", model: "mock-fast", timeout_ms: 15000 },
        local: { provider: "ollama", model: "llama3.2", timeout_ms: 60000 },
      },
      provider_strategy: {
        prefer_free: false,
        allow_local: true,
        max_daily_cost_usd: 10.00,
        health_check_enabled: true,
        fallback_enabled: true,
        task_routing: {
          simple: ["simple-provider"],
          complex: ["complex-provider"],
        },
        fallback_chains: {},
      },
      providers: {},
      cost_tracking: {
        batch_delay_ms: 5000,
        max_batch_size: 50,
        rates: {
          openai: 0.01,
          anthropic: 0.015,
          google: 0,
          ollama: 0,
          mock: 0,
        },
      },
      mock: {
        delay_ms: 500,
        input_tokens: 100,
        output_tokens: 50,
      },
      ui: {
        prompt_preview_length: 50,
        prompt_preview_extended: 100,
      },
      health: {
        check_timeout_ms: 30000,
        cache_ttl_ms: 60000,
        memory_warn_percent: 80,
        memory_critical_percent: 95,
      },
    };

    const selector = new ProviderSelector(ProviderRegistry, costTracker, healthService);

    // Test simple task routing
    const simpleProvider = await selector.selectProviderForTask(config, "simple");
    assertEquals(simpleProvider, "simple-provider");

    // Test complex task routing
    const complexProvider = await selector.selectProviderForTask(config, "complex");
    assertEquals(complexProvider, "complex-provider");
  } finally {
    await cleanup();
  }
});

Deno.test("ProviderSelector: enforces budget constraints", async () => {
  const { db, cleanup } = await initTestDbService();
  try {
    const costTracker = new CostTracker(db);
    const healthService = new HealthCheckService("1.0.0");

    // Track enough usage to exceed budget
    await costTracker.trackRequest("openai", 50000); // $0.50 at $0.01/1K
    await costTracker.flush(); // Ensure the cost is written immediately for the test

    ProviderRegistry.clear();
    ProviderRegistry.registerWithMetadata("openai", new MockProviderFactory(), {
      name: "openai",
      costTier: ProviderCostTier.PAID,
      pricingTier: PricingTier.HIGH,
      capabilities: ["chat"],
      description: "Premium provider",
      strengths: [EvaluationCategory.QUALITY, "speed"],
    });
    ProviderRegistry.registerWithMetadata("free-provider", new MockProviderFactory(), {
      name: "free-provider",
      costTier: ProviderCostTier.FREE,
      pricingTier: PricingTier.FREE,
      capabilities: ["chat"],
      description: "Free provider",
      strengths: ["cost-effective"],
    });

    const selector = new ProviderSelector(ProviderRegistry, costTracker, healthService);

    // Should select free provider when premium exceeds budget
    const provider = await selector.selectProvider({
      maxCostUsd: 0.25, // Budget of $0.25
      requiredCapabilities: ["chat"],
    });

    assertEquals(provider, "free-provider");

    await db.close();
  } finally {
    await cleanup();
  }
});
