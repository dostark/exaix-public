/**
 * Tests for GateEvaluator
 * Phase 15.2: Quality Gate Steps
 */

import { assertEquals, assertExists } from "@std/assert";
import { FlowGateOnFail } from "../../src/enums.ts";

import { GateConfig, GateEvaluator, MockJudgeInvoker } from "../../src/flows/gate_evaluator.ts";
import { EvaluationResult } from "../../src/flows/evaluation_criteria.ts";

const DEFAULT_CONFIG: GateConfig = {
  agent: "judge-agent",
  criteria: ["CODE_CORRECTNESS"],
  threshold: 0.8,
  onFail: FlowGateOnFail.HALT,
  maxRetries: 3,
};

function setupEvaluator(score: number, configOverrides: Partial<GateConfig> = {}) {
  const mockJudge = new MockJudgeInvoker();
  mockJudge.setDefaultScore(score);
  const evaluator = new GateEvaluator(mockJudge);
  const config = { ...DEFAULT_CONFIG, ...configOverrides };
  return { mockJudge, evaluator, config };
}

Deno.test("GateEvaluator: passes gate when score above threshold", async () => {
  const { evaluator, config } = setupEvaluator(0.85);
  const result = await evaluator.evaluate(config, "Test code content");

  assertEquals(result.passed, true);
  assertEquals(result.score >= 0.8, true);
  assertEquals(result.action, "passed");
  assertExists(result.evaluation);
});

Deno.test("GateEvaluator: fails gate when score below threshold", async () => {
  const { evaluator, config } = setupEvaluator(0.65);
  const result = await evaluator.evaluate(config, "Poor quality code");

  assertEquals(result.passed, false);
  assertEquals(result.score < 0.8, true);
});

Deno.test("GateEvaluator: returns retry action when configured", async () => {
  const { evaluator, config } = setupEvaluator(0.6, { onFail: FlowGateOnFail.RETRY });

  // First attempt - should return retry
  const result = await evaluator.evaluate(config, "Content", undefined, 0);

  assertEquals(result.passed, false);
  assertEquals(result.action, FlowGateOnFail.RETRY);
  assertEquals(result.attempts, 1);
});

Deno.test("GateEvaluator: halts after max retries exceeded", async () => {
  const { evaluator, config } = setupEvaluator(0.6, { onFail: FlowGateOnFail.RETRY });

  // Last attempt (attempt 2 = third try with 0-indexing)
  const result = await evaluator.evaluate(config, "Content", undefined, 2);

  assertEquals(result.passed, false);
  assertEquals(result.action, "halted");
  assertEquals(result.attempts, 3);
});

Deno.test("GateEvaluator: continues with warning when configured", async () => {
  const { evaluator, config } = setupEvaluator(0.5, {
    onFail: FlowGateOnFail.CONTINUE_WITH_WARNING,
    maxRetries: 1,
  });

  const result = await evaluator.evaluate(config, "Content");

  assertEquals(result.passed, false);
  assertEquals(result.action, "continued-with-warning");
});

Deno.test("GateEvaluator: uses specific mock result", async () => {
  const { mockJudge, evaluator, config } = setupEvaluator(0.85, { maxRetries: 1 });

  const customResult: EvaluationResult = {
    overallScore: 0.95,
    pass: true,
    feedback: "Excellent!",
    criteriaScores: {
      "code_correctness": {
        name: "code_correctness",
        score: 0.95,
        reasoning: "Perfect",
        issues: [],
        passed: true,
      },
    },
    suggestions: [],
    metadata: {
      evaluatedAt: new Date().toISOString(),
      evaluatorAgent: "judge-agent",
    },
  };
  mockJudge.setMockResult("judge-agent", customResult);

  const result = await evaluator.evaluate(config, "Content");

  assertEquals(result.passed, true);
  assertEquals(result.score, 0.95);
  assertEquals(result.evaluation.feedback, "Excellent!");
});

Deno.test("GateEvaluator: handles edge case scores", async () => {
  // Score exactly matches threshold (0.8)
  const { evaluator, config } = setupEvaluator(0.8, { maxRetries: 1 });
  const result = await evaluator.evaluate(config, "Content");

  assertEquals(result.passed, true);
});

Deno.test("GateEvaluator: tracks evaluation duration", async () => {
  const { evaluator, config } = setupEvaluator(0.85);
  const result = await evaluator.evaluate(config, "Content");

  assertExists(result.evaluationDurationMs);
  assertEquals(result.evaluationDurationMs >= 0, true);
});
