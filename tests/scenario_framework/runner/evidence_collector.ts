/**
 * @module ScenarioFrameworkEvidenceCollector
 * @path tests/scenario_framework/runner/evidence_collector.ts
 * @description Implements Phase 50 Step 5 evidence copy helpers and run
 * manifest persistence with a deterministic output path.
 * @architectural-layer Test
 * @dependencies [@std/path, step_schema]
 * @related-files [tests/scenario_framework/runner/assertions.ts, tests/scenario_framework/tests/unit/assertions_evidence_test.ts]
 */

import { dirname, isAbsolute, resolve } from "@std/path";
import type { ICriterionResult, IScenarioStep } from "../schema/step_schema.ts";

export interface ICopyEvidenceArtifactOptions {
  outputDir: string;
  sourcePath: string;
  relativeDestinationPath: string;
}

export interface IRunManifestStep {
  stepId: string;
  stepType: IScenarioStep["type"];
  executionStatus: string;
  criterionResults: ICriterionResult[];
}

export interface IRunManifest {
  scenarioId: string;
  pack: string;
  mode: string;
  outcome: string;
  steps: IRunManifestStep[];
}

export interface IWriteRunManifestOptions {
  outputDir: string;
  manifest: IRunManifest;
}

const RUN_MANIFEST_FILE = "run-manifest.json";

export async function copyEvidenceArtifact(
  options: ICopyEvidenceArtifactOptions,
): Promise<string> {
  if (isAbsolute(options.relativeDestinationPath)) {
    throw new Error("evidence destination path must be relative");
  }

  const outputDir = resolve(options.outputDir);
  const destinationPath = resolve(outputDir, options.relativeDestinationPath);
  const allowedPrefix = `${outputDir}/`;

  if (destinationPath !== outputDir && !destinationPath.startsWith(allowedPrefix)) {
    throw new Error("evidence destination path escapes output directory");
  }

  await Deno.mkdir(dirname(destinationPath), { recursive: true });
  await Deno.copyFile(resolve(options.sourcePath), destinationPath);
  return options.relativeDestinationPath;
}

export async function writeRunManifest(
  options: IWriteRunManifestOptions,
): Promise<string> {
  const outputDir = resolve(options.outputDir);
  await Deno.mkdir(outputDir, { recursive: true });

  const manifestPath = resolve(outputDir, RUN_MANIFEST_FILE);
  await Deno.writeTextFile(
    manifestPath,
    `${JSON.stringify(options.manifest, null, 2)}\n`,
  );

  return manifestPath;
}
