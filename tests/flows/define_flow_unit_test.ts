/**
 * @module DefineFlowUnitTest
 * @path tests/flows/define_flow_unit_test.ts
 * @description Unit tests for defineFlow utility.
 */

import { assertEquals, assertRejects } from "@std/assert";
import { defineFlow } from "../../src/flows/define_flow.ts";
import { FlowInputSource, FlowOutputFormat } from "../../src/shared/enums.ts";

Deno.test("defineFlow: validation of required fields", () => {
  // @ts-ignore: testing invalid input
  assertRejects(
    () => Promise.resolve(defineFlow({ id: "", name: "n", description: "d", steps: [], output: { from: "s" } })),
    Error,
    "Flow ID cannot be empty",
  );
  // @ts-ignore: testing invalid input
  assertRejects(
    () => Promise.resolve(defineFlow({ id: "id", name: "", description: "d", steps: [], output: { from: "s" } })),
    Error,
    "Flow name cannot be empty",
  );
  // @ts-ignore: testing invalid input
  assertRejects(
    () => Promise.resolve(defineFlow({ id: "id", name: "n", description: "", steps: [], output: { from: "s" } })),
    Error,
    "Flow description cannot be empty",
  );
  // @ts-ignore: testing invalid input
  assertRejects(
    () => Promise.resolve(defineFlow({ id: "id", name: "n", description: "d", steps: [], output: { from: "s" } })),
    Error,
    "Flow must have at least one step",
  );
});

Deno.test("defineFlow: validates step IDs and names", () => {
  assertRejects(
    () =>
      Promise.resolve(defineFlow({
        id: "f",
        name: "n",
        description: "d",
        // @ts-ignore: testing partial step
        steps: [{}],
        output: { from: "s" },
      })),
    Error,
    "Step ID cannot be empty",
  );

  assertRejects(
    () =>
      Promise.resolve(defineFlow({
        id: "f",
        name: "n",
        description: "d",
        // @ts-ignore: testing partial step
        steps: [{ id: "s1" }],
        output: { from: "s" },
      })),
    Error,
    "Step name cannot be empty",
  );
});

Deno.test("defineFlow: applies sensible defaults", () => {
  const flow = defineFlow({
    id: "test-flow",
    name: "Test IFlow as Flow",
    description: "A test flow",
    steps: [{
      id: "step1",
      name: "Step 1",
      agent: "agent-1",
    }],
    output: { from: "step1" },
  });

  assertEquals(flow.version, "1.0.0");
  assertEquals(flow.steps[0].dependsOn, []);
  assertEquals(flow.steps[0].input.source, FlowInputSource.REQUEST);
  assertEquals(flow.steps[0].input.transform, "passthrough");
  assertEquals(flow.steps[0].retry.maxAttempts, 1);
  assertEquals(flow.steps[0].retry.backoffMs, 1000);
  assertEquals(flow.output.format, FlowOutputFormat.MARKDOWN);
  assertEquals(flow.settings.maxParallelism, 3);
  assertEquals(flow.settings.failFast, true);
});

Deno.test("defineFlow: accepts custom configurations", () => {
  const flow = defineFlow({
    id: "custom-flow",
    name: "Custom IFlow as Flow",
    description: "Custom flow",
    version: "2.5.0",
    steps: [{
      id: "s1",
      name: "S1",
      agent: "ag1",
      dependsOn: ["other"],
      input: {
        source: "step",
        stepId: "other",
        transform: "custom",
      },
      retry: {
        maxAttempts: 5,
        backoffMs: 2000,
      },
      condition: "true",
      timeout: 5000,
    }],
    output: { from: "s1", format: "json" },
    settings: {
      maxParallelism: 10,
      failFast: false,
      timeout: 60000,
    },
  });

  assertEquals(flow.version, "2.5.0");
  assertEquals(flow.steps[0].dependsOn, ["other"]);
  assertEquals(flow.steps[0].input.source, "step");
  assertEquals(flow.steps[0].input.stepId, "other");
  assertEquals(flow.steps[0].retry.maxAttempts, 5);
  assertEquals(flow.steps[0].condition, "true");
  assertEquals(flow.steps[0].timeout, 5000);
  assertEquals(flow.output.format, "json");
  assertEquals(flow.settings.maxParallelism, 10);
  assertEquals(flow.settings.failFast, false);
  assertEquals(flow.settings.timeout, 60000);
});
