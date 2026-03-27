/**
 * @module DynamicCriteriaPipelineE2ETest
 * @path tests/integration/34_dynamic_criteria_pipeline_e2e_test.ts
 * @description End-to-end integration tests verifying that dynamic criteria
 * generation, analysis propagation, and goal-aligned evaluation work correctly
 * across the pipeline: FlowRunner -> GateEvaluator -> CriteriaGenerator ->
 * ReflexiveAgent -> ConfidenceScorer (Phase 48, Step 12).
 * @architectural-layer Tests
 * @dependencies [GateEvaluator, CriteriaGenerator, ReflexiveAgent, ConfidenceScorer, FlowRunner]
 * @related-files [.copilot/planning/phase-48-acceptance-criteria-propagation.md]
 */
import { ANALYZER_VERSION } from "../../src/shared/constants.ts";

import { assert, assertEquals, assertGreater, assertStringIncludes } from "@std/assert";
import {
  CritiqueQuality,
  FlowGateOnFail,
  FlowInputSource,
  FlowOutputFormat,
  FlowStepType,
} from "../../src/shared/enums.ts";
import { FlowSchema, type IFlow } from "../../src/shared/schemas/flow.ts";
import {
  FlowRunner,
  type IAgentExecutor,
  type IFlowEventLogger,
  type IFlowStepRequest,
} from "../../src/flows/flow_runner.ts";
import { GateEvaluator, MockJudgeInvoker } from "../../src/flows/gate_evaluator.ts";
import { type EvaluationCriterion, type EvaluationResult } from "../../src/flows/evaluation_criteria.ts";
import { CriteriaGenerator } from "../../src/services/criteria_generator.ts";
import { createReflexiveAgent, type ICritique } from "../../src/services/reflexive_agent.ts";
import { createConfidenceScorer } from "../../src/services/confidence_scorer.ts";
import {
  type IRequestAnalysis,
  RequestAnalysisComplexity,
  RequestTaskType,
} from "../../src/shared/schemas/request_analysis.ts";
import { AnalysisMode } from "../../src/shared/types/request.ts";
import type { IAgentExecutionResult } from "../../src/services/agent_runner.ts";
import type { JSONValue } from "../../src/shared/types/json.ts";
import type { IModelProvider } from "../../src/ai/types.ts";
import { createMockProvider } from "../helpers/mock_provider.ts";

// ============================================================
// Shared fixtures
// ============================================================

function makeAnalysisWithGoals(): IRequestAnalysis {
  return {
    goals: [
      { description: "Implement login feature", explicit: true, priority: 1 },
      { description: "Add tests", explicit: true, priority: 2 },
    ],
    requirements: [],
    constraints: [],
    acceptanceCriteria: ["Login must work with OAuth2"],
    ambiguities: [],
    actionabilityScore: 90,
    complexity: RequestAnalysisComplexity.MEDIUM,
    taskType: RequestTaskType.FEATURE,
    tags: [],
    referencedFiles: [],
    metadata: {
      analyzedAt: new Date().toISOString(),
      durationMs: 10,
      mode: AnalysisMode.HEURISTIC,
      analyzerVersion: ANALYZER_VERSION,
    },
  };
}

function makeAnalysisNoGoals(): IRequestAnalysis {
  return {
    goals: [],
    requirements: [],
    constraints: [],
    acceptanceCriteria: [],
    ambiguities: [],
    actionabilityScore: 50,
    complexity: RequestAnalysisComplexity.SIMPLE,
    taskType: RequestTaskType.BUGFIX,
    tags: [],
    referencedFiles: [],
    metadata: {
      analyzedAt: new Date().toISOString(),
      durationMs: 5,
      mode: AnalysisMode.HEURISTIC,
      analyzerVersion: ANALYZER_VERSION,
    },
  };
}

/** JudgeInvoker that captures the criteria list it receives */
class CapturingJudgeInvoker extends MockJudgeInvoker {
  capturedCriteria: EvaluationCriterion[] = [];

  override evaluate(
    identityId: string,
    content: string,
    criteria: EvaluationCriterion[],
    context?: string,
  ): Promise<EvaluationResult> {
    this.capturedCriteria = [...criteria];
    return super.evaluate(identityId, content, criteria, context);
  }
}

class StubAgentExecutor implements IAgentExecutor {
  async run(_identityId: string, _req: IFlowStepRequest): Promise<IAgentExecutionResult> {
    return await Promise.resolve({ thought: "", content: "stub", raw: "stub" });
  }
}

class SilentLogger implements IFlowEventLogger {
  log(_event: string, _payload: Record<string, JSONValue | undefined>): void {}
}

function makeGateFlowWithCriteria(includeRequestCriteria: boolean): IFlow {
  return FlowSchema.parse({
    id: "e2e-flow",
    name: "E2E Flow",
    description: "E2E integration test flow",
    steps: [
      {
        id: "gate1",
        name: "Quality Gate",
        type: FlowStepType.GATE,
        identity: "judge",
        dependsOn: [],
        input: { source: FlowInputSource.REQUEST },
        evaluate: {
          identity: "judge",
          criteria: ["code_correctness"],
          threshold: 0.05,
          onFail: FlowGateOnFail.HALT,
          maxRetries: 1,
          includeRequestCriteria,
        },
        retry: { maxAttempts: 1, backoffMs: 0 },
      },
    ],
    output: { from: "gate1", format: FlowOutputFormat.MARKDOWN },
  });
}

/** Creates a capturing mock provider that records every prompt sent to it. */
function makeCapturingProvider(responses: string[]): { provider: IModelProvider; prompts: string[] } {
  const prompts: string[] = [];
  let callCount = 0;
  const provider: IModelProvider = {
    id: "capturing-mock",
    generate: (prompt: string): Promise<string> => {
      prompts.push(prompt);
      const response = responses[Math.min(callCount, responses.length - 1)];
      callCount++;
      return Promise.resolve(response);
    },
  };
  return { provider, prompts };
}

function makeXMLResponse(thought: string, content: string): string {
  return `<thought>${thought}</thought><content>${content}</content>`;
}

function makeCritiqueJSON(overrides: Partial<{ quality: string; confidence: number; passed: boolean }>): string {
  return JSON.stringify({
    quality: overrides.quality ?? "good",
    confidence: overrides.confidence ?? 85,
    passed: overrides.passed ?? true,
    issues: [],
    reasoning: "Analysis conducted",
    improvements: [],
  });
}

// ============================================================
// Tests
// ============================================================

Deno.test(
  "[E2E] request goals generate dynamic evaluation criteria",
  async () => {
    const capturing = new CapturingJudgeInvoker();
    capturing.setDefaultScore(0.9);
    const evaluator = new GateEvaluator(capturing, new CriteriaGenerator());
    const runner = new FlowRunner(new StubAgentExecutor(), new SilentLogger(), undefined, evaluator);

    const analysis = makeAnalysisWithGoals();
    const flow = makeGateFlowWithCriteria(true);

    await runner.execute(flow, { userPrompt: "Build login feature", requestAnalysis: analysis });

    const names = capturing.capturedCriteria.map((c) => c.name);
    assert(names.some((n) => n.startsWith("goal_")), `Expected goal_ criteria, got: ${names.join(", ")}`);
    assert(names.some((n) => n.startsWith("ac_")), `Expected ac_ criteria, got: ${names.join(", ")}`);
  },
);

Deno.test(
  "[E2E] acceptance criteria propagate to reflexive agent",
  async () => {
    const { provider, prompts } = makeCapturingProvider([
      makeXMLResponse("thinking", "Implementation done"),
      makeXMLResponse("", makeCritiqueJSON({ quality: "good", confidence: 85, passed: true })),
    ]);

    const agent = createReflexiveAgent(provider, { maxIterations: 1 });
    const analysis = makeAnalysisWithGoals();

    await agent.run(
      { systemPrompt: "You are a developer", identityId: "dev-agent" },
      { userPrompt: "Add OAuth2 login", context: {} },
      analysis,
    );

    const allPrompts = prompts.join("\n");
    assertStringIncludes(allPrompts, "Login must work with OAuth2");
  },
);

Deno.test(
  "[E2E] goal alignment factor in confidence scoring",
  async () => {
    const rawScore = 60;
    const mockProvider = createMockProvider([
      JSON.stringify({
        score: rawScore,
        level: "medium",
        reasoning: "Partial",
        factors: [],
        uncertainty_areas: [],
        requires_review: false,
      }),
    ]);
    const scorer = createConfidenceScorer(mockProvider);

    const allMetCritique: ICritique = {
      quality: CritiqueQuality.GOOD,
      confidence: 80,
      passed: true,
      reasoning: "OK",
      issues: [],
      requirementsFulfillment: [
        { requirement: "req1", status: "MET" },
        { requirement: "req2", status: "MET" },
      ],
    };

    const result = await scorer.assess("request", "response", undefined, allMetCritique);
    assertGreater(result.confidence.score, 0);
  },
);

Deno.test(
  "[E2E] generic fallback without extractable goals",
  async () => {
    const capturing = new CapturingJudgeInvoker();
    capturing.setDefaultScore(0.9);
    const evaluator = new GateEvaluator(capturing, new CriteriaGenerator());
    const runner = new FlowRunner(new StubAgentExecutor(), new SilentLogger(), undefined, evaluator);

    const analysis = makeAnalysisNoGoals();
    const flow = makeGateFlowWithCriteria(true);

    const result = await runner.execute(flow, { userPrompt: "Do something", requestAnalysis: analysis });

    assertEquals(result.success, true);
    assert(
      !capturing.capturedCriteria.some((c) => c.name.startsWith("goal_") || c.name.startsWith("ac_")),
      "Expected no dynamic criteria when analysis has no goals or acceptance criteria",
    );
  },
);

Deno.test(
  "[E2E] flow gate with includeRequestCriteria uses dynamic criteria",
  async () => {
    const capturing = new CapturingJudgeInvoker();
    capturing.setDefaultScore(0.9);
    const evaluator = new GateEvaluator(capturing, new CriteriaGenerator());
    const runner = new FlowRunner(new StubAgentExecutor(), new SilentLogger(), undefined, evaluator);

    const analysis = makeAnalysisWithGoals();
    // Flow-level includeRequestCriteria: true; step has no explicit flag
    const flow = FlowSchema.parse({
      id: "f",
      name: "F",
      description: "D",
      settings: { includeRequestCriteria: true },
      steps: [
        {
          id: "g1",
          name: "Gate",
          type: FlowStepType.GATE,
          identity: "judge",
          dependsOn: [],
          input: { source: FlowInputSource.REQUEST },
          evaluate: {
            identity: "judge",
            criteria: ["code_correctness"],
            threshold: 0.05,
            onFail: FlowGateOnFail.HALT,
            maxRetries: 1,
          },
          retry: { maxAttempts: 1, backoffMs: 0 },
        },
      ],
      output: { from: "g1", format: FlowOutputFormat.MARKDOWN },
    });

    await runner.execute(flow, { userPrompt: "Build feature", requestAnalysis: analysis });

    assert(
      capturing.capturedCriteria.some((c) => c.name.startsWith("goal_")),
      "Flow-level includeRequestCriteria should have injected dynamic criteria",
    );
  },
);

Deno.test(
  "[E2E] pre-Phase-45 plan without requestAnalysis falls back to generic-only criteria",
  async () => {
    const capturing = new CapturingJudgeInvoker();
    capturing.setDefaultScore(0.9);
    const evaluator = new GateEvaluator(capturing, new CriteriaGenerator());
    const runner = new FlowRunner(new StubAgentExecutor(), new SilentLogger(), undefined, evaluator);

    const flow = makeGateFlowWithCriteria(true);

    // Execute WITHOUT requestAnalysis -- simulates pre-Phase-45 plan
    const result = await runner.execute(flow, { userPrompt: "Old plan request" });

    assertEquals(result.success, true);
    assert(
      !capturing.capturedCriteria.some((c) => c.name.startsWith("goal_") || c.name.startsWith("ac_")),
      "Should fall back to static-only criteria when no requestAnalysis provided",
    );
  },
);
