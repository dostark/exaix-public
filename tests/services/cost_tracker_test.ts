import { assert, assertEquals } from "@std/assert";
import { CostTracker } from "../../src/services/cost_tracker.ts";
import { initTestDbService } from "../helpers/db.ts";

/**
 * Tests for CostTracker service.
 *
 * Success Criteria:
 * - Tracks individual requests with token counts and cost estimates
 * - Calculates daily costs accurately
 * - Enforces budget limits correctly
 * - Provides cost summaries for date ranges
 * - Handles multiple providers independently
 * - Uses correct cost rates for different providers
 */

Deno.test("CostTracker: tracks single request", async () => {
  const { db, cleanup } = await initTestDbService();
  try {
    const tracker = new CostTracker(db);

    await tracker.trackRequest("openai", 1000);
    await tracker.flush(); // Flush batch for immediate write

    const dailyCost = await tracker.getDailyCost("openai");
    // 1000 tokens * $0.001 per 1K tokens = $0.001
    assertEquals(dailyCost, 0.001);

    await db.close();
  } finally {
    await cleanup();
  }
});

Deno.test("CostTracker: accumulates multiple requests", async () => {
  const { db, cleanup } = await initTestDbService();
  try {
    const tracker = new CostTracker(db);

    await tracker.trackRequest("openai", 1000);
    await tracker.trackRequest("openai", 2000);
    await tracker.flush(); // Flush batch for immediate write

    const dailyCost = await tracker.getDailyCost("openai");
    // (1000 + 2000) tokens * $0.001 per 1K tokens = $0.003
    assertEquals(dailyCost, 0.003);

    await db.close();
  } finally {
    await cleanup();
  }
});

Deno.test("CostTracker: handles different providers", async () => {
  const { db, cleanup } = await initTestDbService();
  try {
    const tracker = new CostTracker(db);

    await tracker.trackRequest("openai", 1000);
    await tracker.trackRequest("anthropic", 1000);
    await tracker.flush(); // Flush batch for immediate write

    const openaiCost = await tracker.getDailyCost("openai");
    const anthropicCost = await tracker.getDailyCost("anthropic");

    assertEquals(openaiCost, 0.001); // $0.001 per 1K
    assertEquals(anthropicCost, 0.001); // $0.001 per 1K

    await db.close();
  } finally {
    await cleanup();
  }
});

Deno.test("CostTracker: free providers cost zero", async () => {
  const { db, cleanup } = await initTestDbService();
  try {
    const tracker = new CostTracker(db);

    await tracker.trackRequest("ollama", 10000);
    await tracker.trackRequest("google", 10000);
    await tracker.trackRequest("mock", 10000);
    await tracker.flush(); // Flush batch for immediate write

    const ollamaCost = await tracker.getDailyCost("ollama");
    const googleCost = await tracker.getDailyCost("google");
    const mockCost = await tracker.getDailyCost("mock");

    assertEquals(ollamaCost, 0);
    assertEquals(googleCost, 0);
    assertEquals(mockCost, 0);

    await db.close();
  } finally {
    await cleanup();
  }
});

Deno.test("CostTracker: isWithinBudget returns true when under budget", async () => {
  const { db, cleanup } = await initTestDbService();
  try {
    const tracker = new CostTracker(db);

    await tracker.trackRequest("openai", 500); // $0.0005
    await tracker.flush(); // Flush batch for immediate write

    const withinBudget = await tracker.isWithinBudget("openai", 0.01);
    assert(withinBudget);

    await db.close();
  } finally {
    await cleanup();
  }
});

Deno.test("CostTracker: isWithinBudget returns false when over budget", async () => {
  const { db, cleanup } = await initTestDbService();
  try {
    const tracker = new CostTracker(db);

    await tracker.trackRequest("openai", 15000); // $0.015
    await tracker.flush(); // Flush batch for immediate write

    const withinBudget = await tracker.isWithinBudget("openai", 0.01);
    assert(!withinBudget);

    await db.close();
  } finally {
    await cleanup();
  }
});

Deno.test("CostTracker: getDailyCost without provider sums all", async () => {
  const { db, cleanup } = await initTestDbService();
  try {
    const tracker = new CostTracker(db);

    await tracker.trackRequest("openai", 1000); // $0.001
    await tracker.trackRequest("anthropic", 1000); // $0.001
    await tracker.flush(); // Flush batch for immediate write

    const totalCost = await tracker.getDailyCost();
    assertEquals(totalCost, 0.002);

    await db.close();
  } finally {
    await cleanup();
  }
});

Deno.test("CostTracker: getCostSummary returns records in date range", async () => {
  const { db, cleanup } = await initTestDbService();
  try {
    const tracker = new CostTracker(db);

    const startDate = new Date();
    startDate.setHours(0, 0, 0, 0);
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + 1);

    await tracker.trackRequest("openai", 1000);
    await tracker.trackRequest("anthropic", 2000);
    await tracker.flush(); // Flush batch for immediate write

    const summary = await tracker.getCostSummary(startDate, endDate);

    assertEquals(summary.length, 2);
    assertEquals(summary[0].provider, "anthropic"); // Most recent first
    assertEquals(summary[0].tokens, 2000);
    assertEquals(summary[0].estimatedCostUsd, 0.002); // 2000 tokens * $0.001
    assertEquals(summary[1].provider, "openai");
    assertEquals(summary[1].tokens, 1000);
    assertEquals(summary[1].estimatedCostUsd, 0.001);

    await db.close();
  } finally {
    await cleanup();
  }
});

Deno.test("CostTracker: getCostSummary filters by provider", async () => {
  const { db, cleanup } = await initTestDbService();
  try {
    const tracker = new CostTracker(db);

    const startDate = new Date();
    startDate.setHours(0, 0, 0, 0);
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + 1);

    await tracker.trackRequest("openai", 1000);
    await tracker.trackRequest("anthropic", 2000);
    await tracker.flush(); // Flush batch for immediate write

    const openaiSummary = await tracker.getCostSummary(startDate, endDate, "openai");

    assertEquals(openaiSummary.length, 1);
    assertEquals(openaiSummary[0].provider, "openai");

    await db.close();
  } finally {
    await cleanup();
  }
});
