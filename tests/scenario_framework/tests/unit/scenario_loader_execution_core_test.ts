/**
 * @module ScenarioFrameworkScenarioLoaderExecutionCoreTest
 * @path tests/scenario_framework/tests/unit/scenario_loader_execution_core_test.ts
 * @description RED-first tests for Phase 50 Step 3. Verifies YAML scenario
 * loading, runtime config parsing, and execution-core step handling before the
 * loader and executor implementations exist.
 * @architectural-layer Test
 * @related-files [tests/scenario_framework/runner/scenario_loader.ts, tests/scenario_framework/runner/step_executor.ts, tests/scenario_framework/runner/config.ts]
 */

import { assert, assertEquals, assertRejects } from "@std/assert";
import { assertStringIncludes, assertThrows } from "@std/assert";
import { join } from "@std/path";
import { loadRuntimeConfig } from "../../runner/config.ts";
import { loadScenarioFromYamlFile } from "../../runner/scenario_loader.ts";
import { executeScenarioStep } from "../../runner/step_executor.ts";
import { ScenarioStepType } from "../../schema/step_schema.ts";

function createValidScenarioYaml(requestFixturePath: string): string {
  return [
    'schema_version: "1.0.0"',
    'id: "phase50-step3-loader"',
    'title: "Scenario loader returns ordered validated steps"',
    'pack: "smoke"',
    'tags: ["smoke", "loader"]',
    `request_fixture: "${requestFixturePath}"`,
    'mode_support: ["auto"]',
    "portals: []",
    "steps:",
    '  - id: "first-step"',
    '    type: "shell"',
    '    command: "echo"',
    '    args: ["first"]',
    "    input_criteria: []",
    "    output_criteria: []",
    '  - id: "second-step"',
    '    type: "shell"',
    '    command: "echo"',
    '    args: ["second"]',
    "    input_criteria: []",
    "    output_criteria: []",
    "",
  ].join("\n");
}

Deno.test("[ScenarioFrameworkExecutionCore] scenario loader returns ordered validated steps for a valid scenario document", async () => {
  const frameworkHome = await Deno.makeTempDir({ prefix: "scenario-framework-" });

  try {
    const fixtureRelativePath = "fixtures/requests/shared/request.md";
    const scenarioRelativePath = "scenarios/smoke/loader.yaml";

    await Deno.mkdir(join(frameworkHome, "fixtures/requests/shared"), { recursive: true });
    await Deno.mkdir(join(frameworkHome, "scenarios/smoke"), { recursive: true });
    await Deno.writeTextFile(join(frameworkHome, fixtureRelativePath), "# Request\n\nLoad me.\n");
    await Deno.writeTextFile(
      join(frameworkHome, scenarioRelativePath),
      createValidScenarioYaml(fixtureRelativePath),
    );

    const loadedScenario = await loadScenarioFromYamlFile({
      frameworkHome,
      scenarioPath: scenarioRelativePath,
    });

    assertEquals(loadedScenario.scenario.id, "phase50-step3-loader");
    assertEquals(loadedScenario.steps.map((step) => step.id), ["first-step", "second-step"]);
    assertStringIncludes(loadedScenario.requestFixture.content, "Load me");
  } finally {
    await Deno.remove(frameworkHome, { recursive: true });
  }
});

Deno.test("[ScenarioFrameworkExecutionCore] scenario loader rejects documents that violate schema contracts with a descriptive error", async () => {
  const frameworkHome = await Deno.makeTempDir({ prefix: "scenario-framework-" });

  try {
    const fixtureRelativePath = "fixtures/requests/shared/request.md";
    const scenarioRelativePath = "scenarios/smoke/invalid.yaml";

    await Deno.mkdir(join(frameworkHome, "fixtures/requests/shared"), { recursive: true });
    await Deno.mkdir(join(frameworkHome, "scenarios/smoke"), { recursive: true });
    await Deno.writeTextFile(join(frameworkHome, fixtureRelativePath), "# Request\n\nLoad me.\n");
    await Deno.writeTextFile(
      join(frameworkHome, scenarioRelativePath),
      [
        'schema_version: "1.0.0"',
        'id: "invalid-scenario"',
        'pack: "smoke"',
        'tags: ["smoke"]',
        `request_fixture: "${fixtureRelativePath}"`,
        'mode_support: ["auto"]',
        "portals: []",
        "steps: []",
        "",
      ].join("\n"),
    );

    await assertRejects(
      async () => {
        await loadScenarioFromYamlFile({
          frameworkHome,
          scenarioPath: scenarioRelativePath,
        });
      },
      Error,
      "title",
    );
  } finally {
    await Deno.remove(frameworkHome, { recursive: true });
  }
});

Deno.test("[ScenarioFrameworkExecutionCore] shell step executor captures stdout and stderr independently", async () => {
  const executionResult = await executeScenarioStep({
    step: {
      id: "shell-step",
      type: ScenarioStepType.SHELL,
      command: Deno.execPath(),
      args: [
        "eval",
        'console.log("stdout-line"); console.error("stderr-line");',
      ],
      input_criteria: [],
      output_criteria: [],
      continue_on_failure: false,
    },
  });

  assertEquals(executionResult.exitCode, 0);
  assertStringIncludes(executionResult.stdout, "stdout-line");
  assertStringIncludes(executionResult.stderr, "stderr-line");
});

Deno.test("[ScenarioFrameworkExecutionCore] exoctl steps execute and capture output through the configured executable", async () => {
  const executionResult = await executeScenarioStep({
    step: {
      id: "exoctl-step",
      type: ScenarioStepType.EXOCTL,
      command: "eval",
      args: [
        'console.log("exoctl-line");',
      ],
      input_criteria: [],
      output_criteria: [],
      continue_on_failure: false,
    },
    exoctlExecutable: Deno.execPath(),
  });

  assertEquals(executionResult.exitCode, 0);
  assertStringIncludes(executionResult.stdout, "exoctl-line");
});

Deno.test("[ScenarioFrameworkExecutionCore] execution core records step start time, end time, exit code, and raw output", async () => {
  const executionResult = await executeScenarioStep({
    step: {
      id: "timed-step",
      type: ScenarioStepType.SHELL,
      command: Deno.execPath(),
      args: [
        "eval",
        'console.log("combined-output");',
      ],
      input_criteria: [],
      output_criteria: [],
      continue_on_failure: false,
    },
  });

  assert(executionResult.startedAt.length > 0);
  assert(executionResult.completedAt.length > 0);
  assert(executionResult.durationMs >= 0);
  assertEquals(executionResult.exitCode, 0);
  assertStringIncludes(executionResult.combinedOutput, "combined-output");
});

Deno.test("[ScenarioFrameworkExecutionCore] runtime config loader rejects unknown fields and missing required fields", () => {
  assertThrows(
    () => {
      loadRuntimeConfig({ mode: "auto" });
    },
    Error,
    "workspace_path",
  );

  assertThrows(
    () => {
      loadRuntimeConfig({
        workspace_path: "/tmp/workspace",
        output_dir: "/tmp/output",
        mode: "auto",
        unexpected: true,
      });
    },
    Error,
    "Unrecognized key",
  );
});
