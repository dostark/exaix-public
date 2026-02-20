import { assertEquals, assertExists, assertStringIncludes } from "@std/assert";
import { CritiqueIssueType, CritiqueQuality, CritiqueSeverity } from "../../src/enums.ts";
import { createCodeReviewReflexiveAgent, type Critique, ReflexiveAgent } from "../../src/services/reflexive_agent.ts";
import type { AgentExecutionResult, Blueprint, ParsedRequest } from "../../src/services/agent_runner.ts";
import type { IModelProvider } from "../../src/ai/providers.ts";
import type { DatabaseService as _DatabaseService } from "../../src/services/db.ts";
import type { AgentRunner } from "../../src/services/agent_runner.ts";
import type { OutputValidator } from "../../src/services/output_validator.ts";
import type { CircuitBreaker } from "../../src/ai/circuit_breaker.ts";

const stubProvider: IModelProvider = {
  id: "stub",
  generate: (_prompt: string) => Promise.resolve("ok"),
};

interface ReflectiveAccessor {
  config: {
    maxIterations: number;
    minQuality: CritiqueQuality;
    confidenceThreshold: number;
    critiquePromptTemplate: string;
    refinementPromptTemplate: string;
    verbose: boolean;
  };
  metrics: any;
  agentRunner: AgentRunner;
  critiqueRunner: AgentRunner;
  outputValidator: OutputValidator;
  agentBreaker: CircuitBreaker;
  critiqueBreaker: CircuitBreaker;
  shouldAccept(critique: Critique): boolean;
  updateMetrics(critique: Critique): void;
  logActivity(
    actor: string,
    type: string,
    target: string | null,
    payload: Record<string, unknown>,
    traceId: string,
  ): void;
  critique(request: ParsedRequest, response: AgentExecutionResult): Promise<Critique>;
}

Deno.test("ReflexiveAgent.shouldAccept: rejects critical issues regardless", () => {
  const agent = new ReflexiveAgent(stubProvider, { confidenceThreshold: 100, maxIterations: 1 });
  // @ts-expect-error test mock accessing private properties
  const accessor: ReflectiveAccessor = agent;

  const critique: Critique = {
    quality: CritiqueQuality.EXCELLENT,
    confidence: 100,
    passed: true,
    issues: [{ type: CritiqueIssueType.OTHER, severity: CritiqueSeverity.CRITICAL, description: "x" }],
    reasoning: "r",
  };

  const ok = accessor.shouldAccept(critique);
  assertEquals(ok, false);
});

Deno.test("ReflexiveAgent.updateMetrics/resetMetrics track distributions", () => {
  const agent = new ReflexiveAgent(stubProvider, { maxIterations: 1 });
  // @ts-expect-error test mock accessing private properties
  const accessor: ReflectiveAccessor = agent;

  agent.resetMetrics();
  const critique: Critique = {
    quality: CritiqueQuality.GOOD,
    confidence: 10,
    passed: false,
    issues: [{ type: CritiqueIssueType.CLARITY, severity: CritiqueSeverity.MINOR, description: "x" }],
    reasoning: "r",
  };

  accessor.updateMetrics(critique);
  const metrics = agent.getMetrics();

  assertEquals(metrics.qualityDistribution[CritiqueQuality.GOOD], 1);
  assertEquals(metrics.issueTypeDistribution[CritiqueIssueType.CLARITY], 1);
});

Deno.test("createCodeReviewReflexiveAgent: applies stricter defaults", () => {
  const agent = createCodeReviewReflexiveAgent(stubProvider);
  // @ts-expect-error test mock accessing private properties
  const accessor: ReflectiveAccessor = agent;
  const cfg = accessor.config;

  assertEquals(cfg.maxIterations, 2);
  assertEquals(cfg.minQuality, CritiqueQuality.GOOD);
  assertEquals(cfg.confidenceThreshold, 80);
});

Deno.test("ReflexiveAgent.logActivity: writes to db when present", () => {
  const calls: unknown[] = [];
  const db = {
    logActivity: (...args: unknown[]) => calls.push(args),
  };

  const agent = new ReflexiveAgent(stubProvider, {
    // @ts-expect-error test mock
    db: db,
    maxIterations: 1,
  });
  // @ts-expect-error test mock accessing private properties
  const accessor: ReflectiveAccessor = agent;
  accessor.logActivity("a", "t", null, { k: 1 }, "trace");

  assertEquals(calls.length, 1);
});

Deno.test("ReflexiveAgent.shouldAccept: accepts when confidence meets threshold", () => {
  const agent = new ReflexiveAgent(stubProvider, { confidenceThreshold: 60, maxIterations: 1 });
  // @ts-expect-error test mock accessing private properties
  const accessor: ReflectiveAccessor = agent;

  const critique: Critique = {
    quality: CritiqueQuality.POOR,
    confidence: 60,
    passed: false,
    issues: [],
    reasoning: "r",
  };

  const ok = accessor.shouldAccept(critique);
  assertEquals(ok, true);
});

Deno.test("ReflexiveAgent.shouldAccept: accepts when quality meets minQuality", () => {
  const agent = new ReflexiveAgent(stubProvider, { minQuality: CritiqueQuality.ACCEPTABLE, maxIterations: 1 });
  // @ts-expect-error test mock accessing private properties
  const accessor: ReflectiveAccessor = agent;

  const critique: Critique = {
    quality: CritiqueQuality.GOOD,
    confidence: 0,
    passed: false,
    issues: [],
    reasoning: "r",
  };

  const ok = accessor.shouldAccept(critique);
  assertEquals(ok, true);
});

Deno.test("ReflexiveAgent.critique: defaults to acceptable when critique response cannot be parsed", async () => {
  const agent = new ReflexiveAgent(stubProvider, { maxIterations: 1 });
  // @ts-expect-error test mock accessing private properties
  const accessor: ReflectiveAccessor = agent;

  // @ts-expect-error test mock
  accessor.critiqueRunner = {
    run: () => Promise.resolve({ content: "not-json", thought: "", raw: "" }),
  };

  const critique = await accessor.critique(
    { userPrompt: "u", context: {}, traceId: "t" } satisfies ParsedRequest,
    { content: "resp", thought: "", raw: "" } satisfies AgentExecutionResult,
  );

  assertExists(critique);
  assertEquals(critique.quality, CritiqueQuality.ACCEPTABLE);
  assertEquals(critique.passed, true);
  assertStringIncludes(critique.reasoning, "Unable to parse critique");
});

Deno.test("ReflexiveAgent.run: early-exits on first passing critique", async () => {
  const agent = new ReflexiveAgent(stubProvider, { maxIterations: 3 });
  // @ts-expect-error test mock accessing private properties
  const accessor: ReflectiveAccessor = agent;

  // Make circuit breakers no-ops for deterministic unit testing.
  accessor.agentBreaker.execute = (fn: () => Promise<any>) => fn();
  accessor.critiqueBreaker.execute = (fn: () => Promise<any>) => fn();

  let agentRuns = 0;
  // @ts-expect-error test mock
  accessor.agentRunner = {
    run: () => {
      agentRuns++;
      return Promise.resolve({ content: `resp-${agentRuns}`, thought: "", raw: "" });
    },
  };

  // @ts-expect-error test mock
  accessor.critiqueRunner = {
    run: () => Promise.resolve({ content: "ignored", thought: "", raw: "" }),
  };

  // @ts-ignore test mock
  accessor.outputValidator = {
    validate: () => ({
      success: true,
      value: {
        quality: CritiqueQuality.ACCEPTABLE,
        confidence: 100,
        passed: true,
        issues: [],
        reasoning: "ok",
      } as any,
      repairAttempted: false,
      repairSucceeded: false,
      raw: "",
    }),
  };

  const result = await agent.run(
    { systemPrompt: "", agentId: "agent" } satisfies Blueprint,
    { userPrompt: "u", context: {}, traceId: "t" } satisfies ParsedRequest,
  );

  assertEquals(result.totalIterations, 1);
  assertEquals(result.earlyExit, true);
  assertEquals(result.final.content, "resp-1");
  assertEquals(agentRuns, 1);
});

Deno.test("ReflexiveAgent.run: refines when critique fails then accepts", async () => {
  const agent = new ReflexiveAgent(stubProvider, { maxIterations: 2, confidenceThreshold: 70 });
  // @ts-expect-error test mock accessing private properties
  const accessor: ReflectiveAccessor = agent;

  accessor.agentBreaker.execute = (fn: () => Promise<any>) => fn();
  accessor.critiqueBreaker.execute = (fn: () => Promise<any>) => fn();

  const responses = ["v1", "v2"];
  const prompts: string[] = [];
  // @ts-expect-error test mock
  accessor.agentRunner = {
    run: (_blueprint: unknown, req: { userPrompt: string }) => {
      prompts.push(req.userPrompt);
      const content = responses.shift() ?? "final";
      return Promise.resolve({ content, thought: "", raw: "" });
    },
  };

  // @ts-expect-error test mock
  accessor.critiqueRunner = {
    run: () => Promise.resolve({ content: "ignored", thought: "", raw: "" }),
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

  // @ts-ignore test mock
  accessor.outputValidator = {
    validate: () => ({
      success: true,
      value: critiques.shift() as any,
      repairAttempted: false,
      repairSucceeded: false,
      raw: "",
    }),
  };

  const result = await agent.run(
    { systemPrompt: "", agentId: "agent" } satisfies Blueprint,
    { userPrompt: "u", context: {}, traceId: "t" } satisfies ParsedRequest,
  );

  assertEquals(result.totalIterations, 2);
  assertEquals(result.earlyExit, false);
  assertEquals(result.final.content, "v2");
  assertEquals(prompts.length, 2);
  assertStringIncludes(prompts[1], "No specific improvements suggested");
  assertStringIncludes(prompts[1], "No specific issues listed");
});
