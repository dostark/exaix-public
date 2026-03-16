/**
 * @module ScenarioFrameworkAssertionsEvidenceTest
 * @path tests/scenario_framework/tests/unit/assertions_evidence_test.ts
 * @description RED-first tests for Phase 50 Step 5. Verifies criterion
 * evaluation, step outcome classification, and deterministic evidence/manifest
 * writing before the assertion and evidence modules exist.
 * @architectural-layer Test
 * @related-files [tests/scenario_framework/runner/assertions.ts, tests/scenario_framework/runner/evidence_collector.ts, tests/scenario_framework/schema/step_schema.ts]
 */

import { assertEquals, assertStringIncludes } from "@std/assert";
import { join } from "@std/path";
import { evaluateCriterion, evaluateStepOutcome } from "../../runner/assertions.ts";
import { copyEvidenceArtifact, writeRunManifest } from "../../runner/evidence_collector.ts";
import { CriterionKind, CriterionPhase, CriterionStatus, ScenarioStepType } from "../../schema/step_schema.ts";

Deno.test("[ScenarioFrameworkAssertionsEvidence] criterion evaluator distinguishes input validation, execution failure, and output validation failure", async () => {
  const workspaceRoot = await Deno.makeTempDir({ prefix: "scenario-framework-assertions-" });

  try {
    const missingInput = await evaluateStepOutcome({
      workspaceRoot,
      step: {
        id: "input-step",
        type: ScenarioStepType.SHELL,
        command: "echo",
        input_criteria: [
          {
            id: "input-file",
            kind: CriterionKind.FILE_EXISTS,
            path: "missing.txt",
          },
        ],
        output_criteria: [],
        continue_on_failure: false,
      },
    });

    assertEquals(missingInput.failureStage, CriterionPhase.INPUT);
    assertEquals(missingInput.criterionResults[0].status, CriterionStatus.FAILED);

    const executionFailure = await evaluateStepOutcome({
      workspaceRoot,
      step: {
        id: "execution-step",
        type: ScenarioStepType.SHELL,
        command: "echo",
        input_criteria: [],
        output_criteria: [],
        continue_on_failure: false,
      },
      executionResult: {
        stepId: "execution-step",
        stepType: ScenarioStepType.SHELL,
        startedAt: new Date().toISOString(),
        completedAt: new Date().toISOString(),
        durationMs: 1,
        exitCode: 1,
        stdout: "",
        stderr: "command failed",
        combinedOutput: "command failed",
      },
    });

    assertEquals(executionFailure.failureStage, "execution");

    const outputJsonPath = join(workspaceRoot, "result.json");
    await Deno.writeTextFile(outputJsonPath, JSON.stringify({ status: "ok" }));

    const outputFailure = await evaluateStepOutcome({
      workspaceRoot,
      step: {
        id: "output-step",
        type: ScenarioStepType.SHELL,
        command: "echo",
        input_criteria: [],
        output_criteria: [
          {
            id: "json-goal",
            kind: CriterionKind.JSON_PATH_EXISTS,
            path: "$.goal",
            target_file: "result.json",
          },
        ],
        continue_on_failure: false,
      },
      executionResult: {
        stepId: "output-step",
        stepType: ScenarioStepType.SHELL,
        startedAt: new Date().toISOString(),
        completedAt: new Date().toISOString(),
        durationMs: 1,
        exitCode: 0,
        stdout: "ok",
        stderr: "",
        combinedOutput: "ok",
      },
    });

    assertEquals(outputFailure.failureStage, CriterionPhase.OUTPUT);
    assertEquals(outputFailure.criterionResults[0].status, CriterionStatus.FAILED);
  } finally {
    await Deno.remove(workspaceRoot, { recursive: true });
  }
});

Deno.test("[ScenarioFrameworkAssertionsEvidence] JSON, file, frontmatter, and journal assertions report stable failure payloads", async () => {
  const workspaceRoot = await Deno.makeTempDir({ prefix: "scenario-framework-assertions-" });

  try {
    await Deno.writeTextFile(join(workspaceRoot, "payload.json"), JSON.stringify({ value: 1 }));
    await Deno.writeTextFile(join(workspaceRoot, "request.md"), "---\nstatus: draft\n---\n\nBody\n");
    await Deno.writeTextFile(join(workspaceRoot, "journal.ndjson"), '{"event_type":"request.created"}\n');

    const jsonResult = await evaluateCriterion({
      workspaceRoot,
      phase: CriterionPhase.OUTPUT,
      criterion: {
        id: "json-value",
        kind: CriterionKind.JSON_PATH_EQUALS,
        path: "$.value",
        equals: 2,
        target_file: "payload.json",
      },
    });
    const fileResult = await evaluateCriterion({
      workspaceRoot,
      phase: CriterionPhase.INPUT,
      criterion: {
        id: "missing-file",
        kind: CriterionKind.FILE_EXISTS,
        path: "missing.txt",
      },
    });
    const frontmatterResult = await evaluateCriterion({
      workspaceRoot,
      phase: CriterionPhase.OUTPUT,
      criterion: {
        id: "frontmatter-status",
        kind: CriterionKind.FRONTMATTER_FIELD_EQUALS,
        field: "status",
        equals: "published",
        target_file: "request.md",
      },
    });
    const journalResult = await evaluateCriterion({
      workspaceRoot,
      phase: CriterionPhase.OUTPUT,
      criterion: {
        id: "journal-event",
        kind: CriterionKind.JOURNAL_EVENT_EXISTS,
        event_type: "request.completed",
        journal_file: "journal.ndjson",
      },
    });

    assertEquals(jsonResult.status, CriterionStatus.FAILED);
    assertEquals(jsonResult.expected_value, 2);
    assertEquals(jsonResult.observed_value, 1);

    assertEquals(fileResult.status, CriterionStatus.FAILED);
    assertStringIncludes(fileResult.message, "missing.txt");

    assertEquals(frontmatterResult.status, CriterionStatus.FAILED);
    assertEquals(frontmatterResult.observed_value, "draft");

    assertEquals(journalResult.status, CriterionStatus.FAILED);
    assertStringIncludes(journalResult.message, "request.completed");
  } finally {
    await Deno.remove(workspaceRoot, { recursive: true });
  }
});

Deno.test("[ScenarioFrameworkAssertionsEvidence] evidence collector writes the expected manifest shape for success and failure cases", async () => {
  const outputDir = await Deno.makeTempDir({ prefix: "scenario-framework-evidence-" });

  try {
    const manifestPath = await writeRunManifest({
      outputDir,
      manifest: {
        scenarioId: "phase50-step5-manifest",
        pack: "smoke",
        mode: "auto",
        outcome: "scenario-failure",
        steps: [
          {
            stepId: "step-1",
            stepType: ScenarioStepType.SHELL,
            executionStatus: "failed",
            criterionResults: [
              {
                criterion_id: "missing-file",
                kind: CriterionKind.FILE_EXISTS,
                phase: CriterionPhase.INPUT,
                status: CriterionStatus.FAILED,
                message: "missing file",
                evidence_refs: ["artifacts/log.txt"],
              },
            ],
          },
        ],
      },
    });

    const manifest = JSON.parse(await Deno.readTextFile(manifestPath)) as {
      scenarioId: string;
      outcome: string;
      steps: Array<
        { stepId: string; criterionResults: Array<{ criterion_id: string; status: string; evidence_refs: string[] }> }
      >;
    };

    assertEquals(manifest.scenarioId, "phase50-step5-manifest");
    assertEquals(manifest.outcome, "scenario-failure");
    assertEquals(manifest.steps[0].criterionResults[0].criterion_id, "missing-file");
  } finally {
    await Deno.remove(outputDir, { recursive: true });
  }
});

Deno.test("[ScenarioFrameworkAssertionsEvidence] failure manifests include step id, criterion id, status, and evidence references", async () => {
  const outputDir = await Deno.makeTempDir({ prefix: "scenario-framework-evidence-" });
  const workspaceRoot = await Deno.makeTempDir({ prefix: "scenario-framework-workspace-" });

  try {
    const sourceArtifact = join(workspaceRoot, "analysis.json");
    await Deno.writeTextFile(sourceArtifact, JSON.stringify({ status: "draft" }));

    const evidenceRef = await copyEvidenceArtifact({
      outputDir,
      sourcePath: sourceArtifact,
      relativeDestinationPath: "artifacts/analysis.json",
    });

    const manifestPath = await writeRunManifest({
      outputDir,
      manifest: {
        scenarioId: "phase50-step5-failure-manifest",
        pack: "smoke",
        mode: "auto",
        outcome: "scenario-failure",
        steps: [
          {
            stepId: "assert-analysis",
            stepType: ScenarioStepType.JSON_ASSERT,
            executionStatus: "failed",
            criterionResults: [
              {
                criterion_id: "goal-missing",
                kind: CriterionKind.JSON_PATH_EXISTS,
                phase: CriterionPhase.OUTPUT,
                status: CriterionStatus.FAILED,
                message: "goal missing",
                evidence_refs: [evidenceRef],
              },
            ],
          },
        ],
      },
    });

    const manifestText = await Deno.readTextFile(manifestPath);
    assertStringIncludes(manifestText, '"stepId": "assert-analysis"');
    assertStringIncludes(manifestText, '"criterion_id": "goal-missing"');
    assertStringIncludes(manifestText, '"status": "failed"');
    assertStringIncludes(manifestText, evidenceRef);
  } finally {
    await Deno.remove(outputDir, { recursive: true });
    await Deno.remove(workspaceRoot, { recursive: true });
  }
});
