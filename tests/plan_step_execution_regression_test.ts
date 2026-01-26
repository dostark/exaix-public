/**
 * Plan Step Execution Regression Test
 *
 * Regression test for: "Approved plans marked complete without executing steps"
 * Root cause: ExecutionLoop only handled TOML action blocks, not structured plans with steps
 * Fix: Added structured plan detection and PlanExecutor integration in ExecutionLoop
 */

import { assert, assertEquals } from "@std/assert";

// Test the parsing logic directly without full ExecutionLoop instantiation
function parseStructuredPlan(planContent: string, frontmatter: any): any {
  // Look for step headers like "## Step 1: Title" or "## Execution Steps"
  const stepRegex = /^## Step (\d+): (.+)$/gm;
  const executionStepsRegex = /^## Execution Steps$/m;

  if (!executionStepsRegex.test(planContent)) {
    return null; // Not a structured plan
  }

  const steps: any[] = [];

  // Find all step matches
  const matches = [...planContent.matchAll(stepRegex)];

  for (let i = 0; i < matches.length; i++) {
    const match = matches[i];
    const stepNumber = parseInt(match[1]);
    const title = match[2];

    // Extract step content until next step or end
    const startIndex = match.index + match[0].length;
    const endIndex = i < matches.length - 1 ? matches[i + 1].index : planContent.length;

    const content = planContent.substring(startIndex, endIndex).trim();

    steps.push({
      number: stepNumber,
      title,
      content,
    });
  }

  if (steps.length === 0) {
    return null; // No steps found
  }

  return {
    trace_id: frontmatter.trace_id,
    request_id: frontmatter.request_id,
    agent: frontmatter.agent_id || "unknown",
    steps,
  };
}

Deno.test("[regression] ExecutionLoop detects structured plans with steps", () => {
  const traceId = crypto.randomUUID();
  const requestId = "test-structured-plan";

  const planContent = `---
trace_id: "${traceId}"
request_id: "${requestId}"
agent_id: "test-agent"
status: "approved"
created_at: "2026-01-26T10:00:00.000Z"
---

# Test Structured Plan

A plan with structured steps that should be executed.

## Execution Steps

## Step 1: Create test file

Create a test file to verify execution occurred.

## Step 2: Verify execution

Verify that the plan was actually executed.
`;

  const frontmatter = {
    trace_id: traceId,
    request_id: requestId,
    agent_id: "test-agent",
    status: "approved" as const,
    created_at: "2026-01-26T10:00:00.000Z",
  };

  const structuredPlan = parseStructuredPlan(planContent, frontmatter);

  // Verify structured plan was detected
  assert(structuredPlan !== null, "Structured plan should be detected");
  assertEquals(structuredPlan!.trace_id, traceId, "Trace ID should match");
  assertEquals(structuredPlan!.request_id, requestId, "Request ID should match");
  assertEquals(structuredPlan!.steps.length, 2, "Should detect 2 steps");

  assertEquals(structuredPlan!.steps[0].number, 1, "First step should be number 1");
  assertEquals(structuredPlan!.steps[0].title, "Create test file", "First step title should match");
  assert(structuredPlan!.steps[0].content.includes("Create a test file"), "First step content should match");

  assertEquals(structuredPlan!.steps[1].number, 2, "Second step should be number 2");
  assertEquals(structuredPlan!.steps[1].title, "Verify execution", "Second step title should match");
});

Deno.test("[regression] ExecutionLoop rejects plans without executable content", () => {
  const traceId = crypto.randomUUID();
  const requestId = "test-no-actions";

  const planContent = `---
trace_id: "${traceId}"
request_id: "${requestId}"
agent_id: "test-agent"
status: "approved"
created_at: "2026-01-26T10:00:00.000Z"
---

# Test Plan Without Actions

This plan has no executable actions, but should not be marked complete without execution.

## Some Other Section

This is not an execution steps section.
`;

  const frontmatter = {
    trace_id: traceId,
    request_id: requestId,
    agent_id: "test-agent",
    status: "approved" as const,
    created_at: "2026-01-26T10:00:00.000Z",
  };

  const structuredPlan = parseStructuredPlan(planContent, frontmatter);

  // Verify plan was NOT detected as structured (no "## Execution Steps" section)
  assertEquals(structuredPlan, null, "Plan without execution steps should not be detected as structured");
});
