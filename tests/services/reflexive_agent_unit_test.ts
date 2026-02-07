import { assertEquals, assertExists, assertStringIncludes } from "@std/assert";
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

Deno.test("ReflexiveAgent.shouldAccept: accepts when confidence meets threshold", () => {
  const agent = new ReflexiveAgent(stubProvider, { confidenceThreshold: 60, maxIterations: 1 } as any);

  const critique = {
    quality: CritiqueQuality.POOR,
    confidence: 60,
    passed: false,
    issues: [],
    reasoning: "r",
  } as any;

  const ok = (agent as any).shouldAccept(critique);
  assertEquals(ok, true);
});

Deno.test("ReflexiveAgent.shouldAccept: accepts when quality meets minQuality", () => {
  const agent = new ReflexiveAgent(stubProvider, { minQuality: CritiqueQuality.ACCEPTABLE, maxIterations: 1 } as any);

  const critique = {
    quality: CritiqueQuality.GOOD,
    confidence: 0,
    passed: false,
    issues: [],
    reasoning: "r",
  } as any;

  const ok = (agent as any).shouldAccept(critique);
  assertEquals(ok, true);
});

Deno.test("ReflexiveAgent.critique: defaults to acceptable when critique response cannot be parsed", async () => {
  const agent = new ReflexiveAgent(stubProvider, { maxIterations: 1 } as any);

  (agent as any).critiqueRunner = {
    run: () => Promise.resolve({ content: "not-json" }),
  };

  const critique = await (agent as any).critique(
    { userPrompt: "u", context: {}, traceId: "t" },
    { content: "resp" },
  );

  assertExists(critique);
  assertEquals(critique.quality, CritiqueQuality.ACCEPTABLE);
  assertEquals(critique.passed, true);
  assertStringIncludes(critique.reasoning, "Unable to parse critique");
});

Deno.test("ReflexiveAgent.run: early-exits on first passing critique", async () => {
  const agent = new ReflexiveAgent(stubProvider, { maxIterations: 3 } as any);

  // Make circuit breakers no-ops for deterministic unit testing.
  (agent as any).agentBreaker.execute = (fn: () => unknown) => fn();
  (agent as any).critiqueBreaker.execute = (fn: () => unknown) => fn();

  let agentRuns = 0;
  (agent as any).agentRunner = {
    run: () => {
      agentRuns++;
      return Promise.resolve({ content: `resp-${agentRuns}` });
    },
  };

  (agent as any).critiqueRunner = {
    run: () => Promise.resolve({ content: "ignored" }),
  };

  (agent as any).outputValidator = {
    validate: () => ({
      success: true,
      value: {
        quality: CritiqueQuality.ACCEPTABLE,
        confidence: 100,
        passed: true,
        issues: [],
        reasoning: "ok",
      },
    }),
  };

  const result = await agent.run(
    { agentId: "agent" } as any,
    { userPrompt: "u", context: {}, traceId: "t" } as any,
  );

  assertEquals(result.totalIterations, 1);
  assertEquals(result.earlyExit, true);
  assertEquals(result.final.content, "resp-1");
  assertEquals(agentRuns, 1);
});

Deno.test("ReflexiveAgent.run: refines when critique fails then accepts", async () => {
  const agent = new ReflexiveAgent(stubProvider, { maxIterations: 2, confidenceThreshold: 70 } as any);

  (agent as any).agentBreaker.execute = (fn: () => unknown) => fn();
  (agent as any).critiqueBreaker.execute = (fn: () => unknown) => fn();

  const responses = ["v1", "v2"];
  const prompts: string[] = [];
  (agent as any).agentRunner = {
    run: (_blueprint: unknown, req: { userPrompt: string }) => {
      prompts.push(req.userPrompt);
      const content = responses.shift() ?? "final";
      return Promise.resolve({ content });
    },
  };

  (agent as any).critiqueRunner = {
    run: () => Promise.resolve({ content: "ignored" }),
  };

  const critiques = [
    {
      quality: CritiqueQuality.POOR,
      confidence: 0,
      passed: false,
      issues: [],
      reasoning: "bad",
      // no improvements -> refine should use default string
    },
    {
      quality: CritiqueQuality.GOOD,
      confidence: 80,
      passed: false,
      issues: [],
      reasoning: "better",
    },
  ];

  (agent as any).outputValidator = {
    validate: () => ({ success: true, value: critiques.shift() }),
  };

  const result = await agent.run(
    { agentId: "agent" } as any,
    { userPrompt: "u", context: {}, traceId: "t" } as any,
  );

  assertEquals(result.totalIterations, 2);
  assertEquals(result.earlyExit, false);
  assertEquals(result.final.content, "v2");
  assertEquals(prompts.length, 2);
  assertStringIncludes(prompts[1], "No specific improvements suggested");
  assertStringIncludes(prompts[1], "No specific issues listed");
});
