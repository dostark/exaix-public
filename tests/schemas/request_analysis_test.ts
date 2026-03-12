/**
 * @module RequestAnalysisSchemaTest
 * @path tests/schemas/request_analysis_test.ts
 * @description Tests for the IRequestAnalysis Zod schema and inferred types,
 * ensuring robust validation of request intent analysis output.
 */

import { assertEquals, assertExists } from "@std/assert";
import {
  AmbiguityImpact,
  AmbiguitySchema,
  RequestAnalysisComplexity,
  RequestAnalysisSchema,
  RequestGoalSchema,
  RequestTaskType,
  RequirementSchema,
} from "../../src/shared/schemas/request_analysis.ts";
import { AnalysisMode } from "../../src/shared/types/request.ts";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const validGoal = {
  description: "Add unit tests for UserService",
  explicit: true,
  priority: 1,
};

const validRequirement = {
  description: "All existing tests must continue to pass",
  confidence: 0.9,
};

const validAmbiguity = {
  description: "Unclear which test framework to use",
  impact: AmbiguityImpact.MEDIUM,
};

const validAnalysis = {
  goals: [validGoal],
  requirements: [validRequirement],
  constraints: ["No new dependencies"],
  acceptanceCriteria: ["100% of new methods are covered"],
  ambiguities: [validAmbiguity],
  actionabilityScore: 75,
  complexity: RequestAnalysisComplexity.MEDIUM,
  taskType: RequestTaskType.TEST,
  tags: ["testing", "unit-test"],
  referencedFiles: ["src/services/user_service.ts"],
  metadata: {
    analyzedAt: new Date().toISOString(),
    durationMs: 42,
    mode: AnalysisMode.HEURISTIC,
  },
};

// ---------------------------------------------------------------------------
// RequestGoalSchema
// ---------------------------------------------------------------------------

Deno.test("[RequestGoalSchema] validates explicit goal", () => {
  const result = RequestGoalSchema.safeParse(validGoal);
  assertEquals(result.success, true);
  if (result.success) {
    assertEquals(result.data.explicit, true);
    assertEquals(result.data.priority, 1);
  }
});

Deno.test("[RequestGoalSchema] validates inferred goal (explicit: false)", () => {
  const result = RequestGoalSchema.safeParse({
    description: "Implied: maintain backward compatibility",
    explicit: false,
    priority: 2,
  });
  assertEquals(result.success, true);
});

Deno.test("[RequestGoalSchema] rejects missing description", () => {
  const result = RequestGoalSchema.safeParse({ explicit: true, priority: 1 });
  assertEquals(result.success, false);
});

Deno.test("[RequestGoalSchema] rejects invalid priority (zero)", () => {
  const result = RequestGoalSchema.safeParse({ ...validGoal, priority: 0 });
  assertEquals(result.success, false);
});

// ---------------------------------------------------------------------------
// RequirementSchema
// ---------------------------------------------------------------------------

Deno.test("[RequirementSchema] validates confidence range 0.0–1.0", () => {
  const low = RequirementSchema.safeParse({ ...validRequirement, confidence: 0.0 });
  const high = RequirementSchema.safeParse({ ...validRequirement, confidence: 1.0 });
  assertEquals(low.success, true);
  assertEquals(high.success, true);
});

Deno.test("[RequirementSchema] rejects confidence above 1.0", () => {
  const result = RequirementSchema.safeParse({ ...validRequirement, confidence: 1.1 });
  assertEquals(result.success, false);
});

Deno.test("[RequirementSchema] rejects confidence below 0.0", () => {
  const result = RequirementSchema.safeParse({ ...validRequirement, confidence: -0.1 });
  assertEquals(result.success, false);
});

Deno.test("[RequirementSchema] rejects missing description", () => {
  const result = RequirementSchema.safeParse({ confidence: 0.5 });
  assertEquals(result.success, false);
});

// ---------------------------------------------------------------------------
// AmbiguitySchema
// ---------------------------------------------------------------------------

Deno.test("[AmbiguitySchema] validates all impact enum values", () => {
  for (const impact of Object.values(AmbiguityImpact)) {
    const result = AmbiguitySchema.safeParse({ description: "some ambiguity", impact });
    assertEquals(result.success, true, `impact=${impact} should be valid`);
  }
});

Deno.test("[AmbiguitySchema] rejects invalid impact value", () => {
  const result = AmbiguitySchema.safeParse({ description: "x", impact: "catastrophic" });
  assertEquals(result.success, false);
});

Deno.test("[AmbiguitySchema] rejects missing impact", () => {
  const result = AmbiguitySchema.safeParse({ description: "x" });
  assertEquals(result.success, false);
});

// ---------------------------------------------------------------------------
// RequestAnalysisSchema — full object
// ---------------------------------------------------------------------------

Deno.test("[RequestAnalysisSchema] validates complete valid analysis", () => {
  const result = RequestAnalysisSchema.safeParse(validAnalysis);
  assertEquals(result.success, true);
  if (result.success) {
    assertEquals(result.data.actionabilityScore, 75);
    assertEquals(result.data.complexity, RequestAnalysisComplexity.MEDIUM);
    assertEquals(result.data.goals.length, 1);
    assertEquals(result.data.requirements.length, 1);
    assertEquals(result.data.ambiguities.length, 1);
    assertExists(result.data.metadata);
  }
});

Deno.test("[RequestAnalysisSchema] rejects missing required fields", () => {
  // goals is required
  const result = RequestAnalysisSchema.safeParse({ ...validAnalysis, goals: undefined });
  assertEquals(result.success, false);
});

Deno.test("[RequestAnalysisSchema] validates actionabilityScore range 0–100", () => {
  const zero = RequestAnalysisSchema.safeParse({ ...validAnalysis, actionabilityScore: 0 });
  const hundred = RequestAnalysisSchema.safeParse({ ...validAnalysis, actionabilityScore: 100 });
  assertEquals(zero.success, true);
  assertEquals(hundred.success, true);
});

Deno.test("[RequestAnalysisSchema] rejects actionabilityScore out of range", () => {
  const neg = RequestAnalysisSchema.safeParse({ ...validAnalysis, actionabilityScore: -1 });
  const over = RequestAnalysisSchema.safeParse({ ...validAnalysis, actionabilityScore: 101 });
  assertEquals(neg.success, false);
  assertEquals(over.success, false);
});

Deno.test("[RequestAnalysisSchema] validates all complexity enum values", () => {
  for (const complexity of Object.values(RequestAnalysisComplexity)) {
    const result = RequestAnalysisSchema.safeParse({ ...validAnalysis, complexity });
    assertEquals(result.success, true, `complexity=${complexity} should be valid`);
  }
});

Deno.test("[RequestAnalysisSchema] rejects invalid complexity value", () => {
  const result = RequestAnalysisSchema.safeParse({ ...validAnalysis, complexity: "gigantic" });
  assertEquals(result.success, false);
});

Deno.test("[RequestAnalysisSchema] validates all taskType enum values", () => {
  for (const taskType of Object.values(RequestTaskType)) {
    const result = RequestAnalysisSchema.safeParse({ ...validAnalysis, taskType });
    assertEquals(result.success, true, `taskType=${taskType} should be valid`);
  }
});

Deno.test("[RequestAnalysisSchema] allows empty arrays for optional list fields", () => {
  const result = RequestAnalysisSchema.safeParse({
    ...validAnalysis,
    requirements: [],
    constraints: [],
    acceptanceCriteria: [],
    ambiguities: [],
    tags: [],
    referencedFiles: [],
  });
  assertEquals(result.success, true);
});

Deno.test("[RequestAnalysisSchema] validates metadata fields", () => {
  const result = RequestAnalysisSchema.safeParse(validAnalysis);
  assertEquals(result.success, true);
  if (result.success) {
    assertExists(result.data.metadata.analyzedAt);
    assertEquals(typeof result.data.metadata.durationMs, "number");
    assertEquals(result.data.metadata.mode, AnalysisMode.HEURISTIC);
  }
});

Deno.test("[RequestAnalysisSchema] validates all analyzer mode values", () => {
  for (const mode of Object.values(AnalysisMode)) {
    const result = RequestAnalysisSchema.safeParse({
      ...validAnalysis,
      metadata: { ...validAnalysis.metadata, mode },
    });
    assertEquals(result.success, true, `mode=${mode} should be valid`);
  }
});
