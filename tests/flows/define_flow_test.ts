import { assertEquals, assertThrows } from "@std/assert";
import { FlowInputSource, FlowOutputFormat } from "../../src/enums.ts";
import { defineFlow } from "../../src/flows/define_flow.ts";
import { FlowSchema } from "../../src/schemas/flow.ts";

// Helper to create a minimal valid flow definition
function defineMinimalFlow(overrides: Record<string, any> = {}) {
  return defineFlow({
    id: "test-flow",
    name: "Test Flow",
    description: "A simple test flow",
    steps: [
      {
        id: "step1",
        name: "First Step",
        agent: "test-agent",
        dependsOn: [],
        input: {
          source: FlowInputSource.REQUEST,
          transform: "passthrough",
        },
        retry: {
          maxAttempts: 1,
          backoffMs: 1000,
        },
      },
    ],
    output: {
      from: "step1",
    },
    ...overrides,
  });
}

// Test defineFlow helper function
Deno.test("defineFlow: creates valid flow definition with minimal required fields", () => {
  const flow = defineMinimalFlow();

  // Validate the flow structure
  assertEquals(flow.id, "test-flow");
  assertEquals(flow.name, "Test Flow");
  assertEquals(flow.description, "A simple test flow");
  assertEquals(flow.version, "1.0.0"); // default value
  assertEquals(flow.steps.length, 1);
  assertEquals(flow.steps[0].id, "step1");
  assertEquals(flow.output.from, "step1");
  assertEquals(flow.output.format, FlowOutputFormat.MARKDOWN); // default value
  assertEquals(flow.settings.maxParallelism, 3); // default value
  assertEquals(flow.settings.failFast, true); // default value

  // Validate against schema
  const result = FlowSchema.parse(flow);
  assertEquals(result.id, "test-flow");
});

Deno.test("defineFlow: creates complex flow with dependencies and custom settings", () => {
  const flow = defineFlow({
    id: "complex-flow",
    name: "Complex Flow",
    description: "A complex flow with dependencies",
    version: "2.1.0",
    steps: [
      {
        id: "setup",
        name: "Setup Environment",
        agent: "setup-agent",
        dependsOn: [],
        input: {
          source: FlowInputSource.REQUEST,
          transform: "passthrough",
        },
        retry: {
          maxAttempts: 1,
          backoffMs: 1000,
        },
      },
      {
        id: "analyze",
        name: "Analyze Code",
        agent: "analyzer-agent",
        dependsOn: ["setup"],
        input: {
          source: FlowInputSource.STEP,
          stepId: "setup",
          transform: "extract-code",
        },
        timeout: 60000,
        retry: {
          maxAttempts: 3,
          backoffMs: 2000,
        },
      },
      {
        id: "review",
        name: "Code Review",
        agent: "reviewer-agent",
        dependsOn: ["analyze"],
        input: {
          source: FlowInputSource.REQUEST,
          transform: "passthrough",
        },
        condition: "result.status === 'success'",
        retry: {
          maxAttempts: 1,
          backoffMs: 1000,
        },
      },
    ],
    output: {
      from: ["analyze", "review"],
      format: FlowOutputFormat.JSON,
    },
    settings: {
      maxParallelism: 2,
      failFast: false,
      timeout: 300000,
    },
  });

  // Validate complex structure
  assertEquals(flow.id, "complex-flow");
  assertEquals(flow.version, "2.1.0");
  assertEquals(flow.steps.length, 3);
  assertEquals(flow.steps[1].dependsOn, ["setup"]);
  assertEquals(flow.steps[1].input.source, FlowInputSource.STEP);
  assertEquals(flow.steps[1].input.stepId, "setup");
  assertEquals(flow.steps[1].timeout, 60000);
  assertEquals(flow.steps[1].retry.maxAttempts, 3);
  assertEquals(flow.output.from, ["analyze", "review"]);
  assertEquals(flow.output.format, FlowOutputFormat.JSON);
  assertEquals(flow.settings.maxParallelism, 2);
  assertEquals(flow.settings.failFast, false);
  assertEquals(flow.settings.timeout, 300000);

  // Validate against schema
  const result = FlowSchema.parse(flow);
  assertEquals(result.id, "complex-flow");
});

Deno.test("defineFlow: rejects invalid flow definitions", () => {
  // Test empty steps array - this should be caught by schema validation
  assertThrows(
    () =>
      defineMinimalFlow({
        id: "test",
        name: "Test",
        description: "Test",
        steps: [],
        output: { from: "nonexistent" },
      }),
    "Flow must have at least one step",
  );
});

Deno.test("defineFlow: applies default values correctly", () => {
  // Minimal overrides, relying on defineFlow to fill in defaults
  // (though defineMinimalFlow fills some too, this test checks defineFlow logic mainly)
  // We'll construct it manually to be sure we are testing defineFlow's default logic
  // but we can reuse the steps logic if we want, or just verify defineMinimalFlow
  // correctly delegates.
  // Actually, let's keep this test focused on defineFlow but use a compact setup.

  const flow = defineFlow({
    id: "minimal",
    name: "Minimal",
    description: "Minimal flow",
    steps: [
      {
        id: "step1",
        name: "Step 1",
        agent: "agent1",
        // Omitting dependsOn, input, and retry to test defaults
      },
    ],
    output: {
      from: "step1",
    },
  });

  // Check all default values are applied
  assertEquals(flow.version, "1.0.0");
  assertEquals(flow.output.format, FlowOutputFormat.MARKDOWN);
  assertEquals(flow.settings.maxParallelism, 3);
  assertEquals(flow.settings.failFast, true);
  assertEquals(flow.steps[0].dependsOn, []);
  assertEquals(flow.steps[0].input.source, FlowInputSource.REQUEST);
  assertEquals(flow.steps[0].input.transform, "passthrough");
  assertEquals(flow.steps[0].retry.maxAttempts, 1);
  assertEquals(flow.steps[0].retry.backoffMs, 1000);
});

Deno.test("defineFlow: allows valid dependency references", () => {
  // Dependencies are validated at the flow level, not in defineFlow
  // This should succeed - validation happens later in FlowRunner
  const flow = defineFlow({
    id: "test",
    name: "Test",
    description: "Test",
    steps: [
      {
        id: "step1",
        name: "Step 1",
        agent: "agent1",
        dependsOn: ["nonexistent"], // This is valid at defineFlow level
        input: {
          source: FlowInputSource.REQUEST,
          transform: "passthrough",
        },
        retry: {
          maxAttempts: 1,
          backoffMs: 1000,
        },
      },
    ],
    output: { from: "step1" },
  });

  assertEquals(flow.steps[0].dependsOn, ["nonexistent"]);
});

Deno.test("defineFlow: throws error for empty flow ID", () => {
  assertThrows(
    () =>
      defineMinimalFlow({
        id: "",
      }),
    Error,
    "Flow ID cannot be empty",
  );
});

Deno.test("defineFlow: throws error for empty flow name", () => {
  assertThrows(
    () =>
      defineMinimalFlow({
        name: "",
      }),
    Error,
    "Flow name cannot be empty",
  );
});

Deno.test("defineFlow: throws error for empty flow description", () => {
  assertThrows(
    () =>
      defineMinimalFlow({
        description: "",
      }),
    Error,
    "Flow description cannot be empty",
  );
});

Deno.test("defineFlow: throws error for empty steps array", () => {
  assertThrows(
    () =>
      defineMinimalFlow({
        steps: [],
      }),
    Error,
    "Flow must have at least one step",
  );
});

Deno.test("defineFlow: throws error for empty step ID", () => {
  assertThrows(
    () =>
      defineMinimalFlow({
        steps: [{ ...defineMinimalFlow().steps[0], id: "" }],
      }),
    Error,
    "Step ID cannot be empty",
  );
});

Deno.test("defineFlow: throws error for empty step name", () => {
  assertThrows(
    () =>
      defineMinimalFlow({
        steps: [{ ...defineMinimalFlow().steps[0], name: "" }],
      }),
    Error,
    "Step name cannot be empty",
  );
});

Deno.test("defineFlow: throws error for empty agent reference", () => {
  assertThrows(
    () =>
      defineMinimalFlow({
        steps: [{ ...defineMinimalFlow().steps[0], agent: "" }],
      }),
    Error,
    "Agent reference cannot be empty",
  );
});

Deno.test("defineFlow: throws error for invalid maxParallelism", () => {
  assertThrows(
    () =>
      defineMinimalFlow({
        settings: { maxParallelism: 0 },
      }),
    Error,
    "Number must be greater than or equal to 1",
  );
});

Deno.test("defineFlow: throws error for invalid retry maxAttempts", () => {
  assertThrows(
    () =>
      defineMinimalFlow({
        steps: [{ ...defineMinimalFlow().steps[0], retry: { maxAttempts: 0, backoffMs: 1000 } }],
      }),
    Error,
    "Number must be greater than or equal to 1",
  );
});

Deno.test("defineFlow: applies all default values when optional fields are omitted", () => {
  const flow = defineFlow({
    id: "defaults-test",
    name: "Defaults Test",
    description: "Test default value application",
    steps: [
      {
        id: "step1",
        name: "Step 1",
        agent: "agent1",
        // Omitting dependsOn, input, and retry to test defaults
      },
    ],
    output: {
      from: "step1",
      // Omitting format to test default
    },
    // Omitting settings to test defaults
  });

  // Verify all default values are applied
  assertEquals(flow.version, "1.0.0");
  assertEquals(flow.output.format, FlowOutputFormat.MARKDOWN);
  assertEquals(flow.settings.maxParallelism, 3);
  assertEquals(flow.settings.failFast, true);
  assertEquals(flow.settings.timeout, undefined);

  // Verify step defaults
  assertEquals(flow.steps[0].dependsOn, []);
  assertEquals(flow.steps[0].input.source, FlowInputSource.REQUEST);
  assertEquals(flow.steps[0].input.transform, "passthrough");
  assertEquals(flow.steps[0].retry.maxAttempts, 1);
  assertEquals(flow.steps[0].retry.backoffMs, 1000);

  // Validate against schema
  const result = FlowSchema.parse(flow);
  assertEquals(result.id, "defaults-test");
});
