import { assertEquals, assertExists, assertStringIncludes } from "@std/assert";
import { CritiqueIssueType, CritiqueQuality, CritiqueSeverity } from "../../src/enums.ts";
import { createCodeReviewReflexiveAgent, type Critique, ReflexiveAgent } from "../../src/services/reflexive_agent.ts";
import type { AgentExecutionResult, Blueprint, ParsedRequest } from "../../src/services/agent_runner.ts";
import type { IModelProvider } from "../../src/ai/providers.ts";
import type { IAgentRunner } from "../../src/services/agent_runner.ts";
import {
  type IOutputValidator,
  type ValidationMetrics,
  type ValidationResult,
} from "../../src/services/output_validator.ts";
import { createStubDb } from "../test_helpers.ts";

function createMockRunner(
  runFn: (blueprint: Blueprint, request: ParsedRequest) => Promise<AgentExecutionResult>,
): IAgentRunner {
  return { run: runFn };
}

function createMockValidator(overrides: Partial<IOutputValidator> = {}): IOutputValidator {
  const defaultResult = { success: false, repairAttempted: false, repairSucceeded: false, raw: "" };

  return {
    validate: <T>(
      _content: string,
      _schema: unknown,
    ): ValidationResult<T> => (defaultResult as unknown as ValidationResult<T>),
    parseXMLTags: (raw: string) => ({ thought: "", content: raw, raw }),
    validateWithSchema: (_content, _schemaName) => (defaultResult as unknown as ValidationResult<any>),
    parseAndValidate: (_raw, _schema) => (defaultResult as unknown as ValidationResult<any>),
    parseAndValidateWithSchema: (_raw, _schemaName) => (defaultResult as unknown as ValidationResult<any>),
    getMetrics: (): ValidationMetrics => ({
      totalAttempts: 0,
      successfulValidations: 0,
      repairAttempts: 0,
      successfulRepairs: 0,
      failuresByErrorType: {},
    }),
    resetMetrics: () => {},
    ...overrides,
  };
}

const stubProvider: IModelProvider = {
  id: "stub",
  generate: (_prompt: string) => Promise.resolve("ok"),
};

Deno.test("ReflexiveAgent.shouldAccept: rejects critical issues regardless", () => {
  const agent = new ReflexiveAgent(stubProvider, { confidenceThreshold: 100, maxIterations: 1 });

  const critique: Critique = {
    quality: CritiqueQuality.EXCELLENT,
    confidence: 100,
    passed: true,
    issues: [{ type: CritiqueIssueType.OTHER, severity: CritiqueSeverity.CRITICAL, description: "x" }],
    reasoning: "r",
  };

  const ok = agent.shouldAccept(critique);
  assertEquals(ok, false);
});

Deno.test("ReflexiveAgent.updateMetrics/resetMetrics track distributions", () => {
  const agent = new ReflexiveAgent(stubProvider, { maxIterations: 1 });

  agent.resetMetrics();
  const critique: Critique = {
    quality: CritiqueQuality.GOOD,
    confidence: 10,
    passed: false,
    issues: [{ type: CritiqueIssueType.CLARITY, severity: CritiqueSeverity.MINOR, description: "x" }],
    reasoning: "r",
  };

  agent.updateMetrics(critique);
  const metrics = agent.getMetrics();

  assertEquals(metrics.qualityDistribution[CritiqueQuality.GOOD], 1);
  assertEquals(metrics.issueTypeDistribution[CritiqueIssueType.CLARITY], 1);
});

Deno.test("createCodeReviewReflexiveAgent: applies stricter defaults", () => {
  const agent = createCodeReviewReflexiveAgent(stubProvider);
  const cfg = agent.config;

  assertEquals(cfg.maxIterations, 2);
  assertEquals(cfg.minQuality, CritiqueQuality.GOOD);
  assertEquals(cfg.confidenceThreshold, 80);
});

Deno.test("ReflexiveAgent.logActivity: writes to db when present", () => {
  const calls: unknown[][] = [];
  const db = createStubDb({
    logActivity: (...args: any[]) => {
      calls.push(args);
    },
  });

  const agent = new ReflexiveAgent(stubProvider, {
    db,
    maxIterations: 1,
  });
  agent.logActivity("a", "t", null, { k: 1 }, "trace");

  assertEquals(calls.length, 1);
});

Deno.test("ReflexiveAgent.shouldAccept: accepts when confidence meets threshold", () => {
  const agent = new ReflexiveAgent(stubProvider, { confidenceThreshold: 60, maxIterations: 1 });

  const critique: Critique = {
    quality: CritiqueQuality.POOR,
    confidence: 60,
    passed: false,
    issues: [],
    reasoning: "r",
  };

  const ok = agent.shouldAccept(critique);
  assertEquals(ok, true);
});

Deno.test("ReflexiveAgent.shouldAccept: accepts when quality meets minQuality", () => {
  const agent = new ReflexiveAgent(stubProvider, { minQuality: CritiqueQuality.ACCEPTABLE, maxIterations: 1 });

  const critique: Critique = {
    quality: CritiqueQuality.GOOD,
    confidence: 0,
    passed: false,
    issues: [],
    reasoning: "r",
  };

  const ok = agent.shouldAccept(critique);
  assertEquals(ok, true);
});

Deno.test("ReflexiveAgent.critique: defaults to acceptable when critique response cannot be parsed", async () => {
  const agent = new ReflexiveAgent(stubProvider, { maxIterations: 1 });

  agent.critiqueRunner = createMockRunner(
    () => Promise.resolve({ content: "not-json", thought: "", raw: "" }),
  );

  const critique = await agent.critique(
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

  // Make circuit breakers no-ops for deterministic unit testing.
  agent.agentBreaker.execute = (fn: () => Promise<any>) => fn();
  agent.critiqueBreaker.execute = (fn: () => Promise<any>) => fn();

  let agentRuns = 0;
  agent.agentRunner = createMockRunner(() => {
    agentRuns++;
    return Promise.resolve({ content: `resp-${agentRuns}`, thought: "", raw: "" });
  });

  agent.critiqueRunner = createMockRunner(
    () => Promise.resolve({ content: "ignored", thought: "", raw: "" }),
  );

  agent.outputValidator = createMockValidator({
    validate: <T>(_content: string, _schema: unknown): ValidationResult<T> => ({
      success: true,
      value: {
        quality: CritiqueQuality.ACCEPTABLE,
        confidence: 100,
        passed: true,
        issues: [],
        reasoning: "ok",
      } as unknown as T,
      repairAttempted: false,
      repairSucceeded: false,
      raw: "",
    }),
  });

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

  agent.agentBreaker.execute = (fn: () => Promise<any>) => fn();
  agent.critiqueBreaker.execute = (fn: () => Promise<any>) => fn();

  const responses = ["v1", "v2"];
  const prompts: string[] = [];
  agent.agentRunner = createMockRunner(
    (_blueprint: Blueprint, req: ParsedRequest) => {
      prompts.push(req.userPrompt);
      const content = responses.shift() ?? "final";
      return Promise.resolve({ content, thought: "", raw: "" });
    },
  );

  agent.critiqueRunner = createMockRunner(
    () => Promise.resolve({ content: "ignored", thought: "", raw: "" }),
  );

  const critiques = [
    {
      quality: CritiqueQuality.POOR,
      confidence: 0,
      passed: false,
      issues: [],
      reasoning: "bad",
    },
    {
      quality: CritiqueQuality.GOOD,
      confidence: 80,
      passed: false,
      issues: [],
      reasoning: "better",
    },
  ];

  agent.outputValidator = createMockValidator({
    validate: <T>(_content: string, _schema: unknown): ValidationResult<T> => ({
      success: true,
      value: critiques.shift() as unknown as T,
      repairAttempted: false,
      repairSucceeded: false,
      raw: "",
    }),
  });

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
