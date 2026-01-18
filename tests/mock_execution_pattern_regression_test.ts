/**
 * MockLLMProvider Execution Pattern Regression Test
 *
 * Regression test for: "step.no_actions - MockLLMProvider returns planning responses for execution prompts"
 * Root cause: getDefaultPatterns() always returned planning responses (plan JSON) regardless of
 *             whether the prompt was for planning or execution
 * Fix: Enhanced pattern matching to detect execution prompts and generate <actions> with tool calls
 *      instead of <content> with plan JSON
 */

import { assertEquals, assertStringIncludes } from "@std/assert";
import { MockLLMProvider } from "../src/ai/providers/mock_llm_provider.ts";
import { MockStrategy } from "../src/enums.ts";

Deno.test("[regression] MockLLMProvider generates planning response for planning prompts", async () => {
  // Create mock provider with recorded strategy (uses pattern fallback)
  const provider = new MockLLMProvider(MockStrategy.RECORDED, {
    recordings: [], // No recordings, will fall back to patterns
  });

  // Planning prompt - requests a plan
  const planningPrompt = `
# Senior Software Engineer Agent

You are an expert software engineer. Create a plan for:

User request: "Add a hello world function to src/utils.ts"
`;

  const response = await provider.generate(planningPrompt);

  // Should contain planning response with <content> and plan JSON
  assertStringIncludes(response, "<thought>");
  assertStringIncludes(response, "<content>");
  assertStringIncludes(response, '"title"');
  assertStringIncludes(response, '"steps"');

  // Should NOT contain execution actions
  assertEquals(response.includes("<actions>"), false, "Planning response should not contain <actions>");
});

Deno.test("[regression] MockLLMProvider generates execution response for execution prompts", async () => {
  // Create mock provider with recorded strategy (uses pattern fallback)
  const provider = new MockLLMProvider(MockStrategy.RECORDED, {
    recordings: [], // No recordings, will fall back to patterns
  });

  // Execution prompt - indicates step execution
  const executionPrompt = `
You are an autonomous coding agent executing a plan.

Current Step: Step 3 - Implement Code
Description: Write the necessary code changes to implement the feature.

Context: User wants to add a hello world function

Execute this step now.
`;

  const response = await provider.generate(executionPrompt);

  // Should contain execution response with <actions>
  assertStringIncludes(response, "<thought>");
  assertStringIncludes(response, "<actions>");

  // Should contain tool calls (JSON array)
  assertStringIncludes(response, '"tool":');
  assertStringIncludes(response, '"params":');

  // Should NOT contain planning JSON
  assertEquals(response.includes('"steps"'), false, "Execution response should not contain plan steps");
  assertEquals(response.includes("<content>"), false, "Execution response should use <actions> not <content>");
});

Deno.test("[regression] MockLLMProvider execution pattern generates write_file action for write prompts", async () => {
  const provider = new MockLLMProvider(MockStrategy.RECORDED, {
    recordings: [],
  });

  const writePrompt = `
You are an autonomous coding agent executing a plan.

Step 5: Write the implementation file

Create src/hello.ts with the hello world function.
`;

  const response = await provider.generate(writePrompt);

  // Should generate write_file action
  assertStringIncludes(response, '"tool": "write_file"');
  assertStringIncludes(response, '"path":');
  assertStringIncludes(response, '"content":');
});

Deno.test("[regression] MockLLMProvider execution pattern generates actions for execution prompts", async () => {
  const provider = new MockLLMProvider(MockStrategy.RECORDED, {
    recordings: [],
  });

  const executionPrompt = `
You are an autonomous coding agent executing a plan.

Step 2: Analyze the current implementation

Read src/index.ts to understand the structure.
`;

  const response = await provider.generate(executionPrompt);

  // The key fix: should generate <actions> (not planning <content>)
  // The specific tool doesn't matter as much as generating actions vs planning
  assertStringIncludes(response, "<actions>");
  assertStringIncludes(response, '"tool":');
  assertStringIncludes(response, '"params":');

  // Should NOT be a planning response
  assertEquals(response.includes('"steps"'), false, "Should not contain planning steps");
  assertEquals(response.includes("<content>"), false, "Should use <actions> not <content>");
});

Deno.test("[regression] MockLLMProvider pattern recognition handles 'Step N' format", async () => {
  const provider = new MockLLMProvider(MockStrategy.RECORDED, {
    recordings: [],
  });

  // Various step formats should all trigger execution pattern
  const prompts = [
    "You are executing Step 1 of the plan",
    "Now execute step 2",
    "Step 3: Implement the feature",
  ];

  for (const prompt of prompts) {
    const response = await provider.generate(prompt);

    assertStringIncludes(
      response,
      "<actions>",
      `Prompt "${prompt}" should generate execution response with <actions>`,
    );
    assertEquals(
      response.includes("<content>"),
      false,
      `Prompt "${prompt}" should not generate planning response with <content>`,
    );
  }
});

Deno.test("[regression] MockLLMProvider distinguishes execution from planning keywords", async () => {
  const provider = new MockLLMProvider(MockStrategy.RECORDED, {
    recordings: [],
  });

  // Planning keywords (implement, add, create) in planning context
  const planningPrompt = "Create a plan to implement the new feature";
  const planningResponse = await provider.generate(planningPrompt);

  assertStringIncludes(planningResponse, "<content>");
  assertStringIncludes(planningResponse, '"steps"');

  // Same keywords in execution context
  const executionPrompt = "You are an autonomous coding agent executing Step 1: Create the file";
  const executionResponse = await provider.generate(executionPrompt);

  assertStringIncludes(executionResponse, "<actions>");
  assertEquals(executionResponse.includes('"steps"'), false);
});
