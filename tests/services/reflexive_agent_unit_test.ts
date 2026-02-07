import { assertEquals } from "@std/assert";
import { CritiqueIssueType, CritiqueQuality, CritiqueSeverity } from "../../src/enums.ts";
import { createCodeReviewReflexiveAgent, ReflexiveAgent } from "../../src/services/reflexive_agent.ts";
import type { IModelProvider } from "../../src/ai/providers.ts";

const stubProvider: IModelProvider = {
  id: "stub",
  generate: () => Promise.resolve("ok"),
} as unknown as IModelProvider;

Deno.test("ReflexiveAgent.shouldAccept: rejects critical issues regardless", () => {
  const agent = new ReflexiveAgent(stubProvider, { confidenceThreshold: 100, maxIterations: 1 } as any);

  const critique = {
    quality: CritiqueQuality.EXCELLENT,
    confidence: 100,
    passed: true,
    issues: [{ type: CritiqueIssueType.OTHER, severity: CritiqueSeverity.CRITICAL, description: "x" }],
    reasoning: "r",
  } as any;

  const ok = (agent as any).shouldAccept(critique);
  assertEquals(ok, false);
});

Deno.test("ReflexiveAgent.updateMetrics/resetMetrics track distributions", () => {
  const agent = new ReflexiveAgent(stubProvider, { maxIterations: 1 } as any);

  agent.resetMetrics();
  const critique = {
    quality: CritiqueQuality.GOOD,
    confidence: 10,
    passed: false,
    issues: [{ type: CritiqueIssueType.CLARITY, severity: CritiqueSeverity.MINOR, description: "x" }],
    reasoning: "r",
  } as any;

  (agent as any).updateMetrics(critique);
  const metrics = agent.getMetrics();

  assertEquals(metrics.qualityDistribution[CritiqueQuality.GOOD], 1);
  assertEquals(metrics.issueTypeDistribution[CritiqueIssueType.CLARITY], 1);
});

Deno.test("createCodeReviewReflexiveAgent: applies stricter defaults", () => {
  const agent = createCodeReviewReflexiveAgent(stubProvider);
  const cfg = (agent as any).config;

  assertEquals(cfg.maxIterations, 2);
  assertEquals(cfg.minQuality, CritiqueQuality.GOOD);
  assertEquals(cfg.confidenceThreshold, 80);
});

Deno.test("ReflexiveAgent.logActivity: writes to db when present", () => {
  const calls: unknown[] = [];
  const db = {
    logActivity: (...args: unknown[]) => calls.push(args),
  };

  const agent = new ReflexiveAgent(stubProvider, { db, maxIterations: 1 } as any);
  (agent as any).logActivity("a", "t", null, { k: 1 }, "trace");

  assertEquals(calls.length, 1);
});
