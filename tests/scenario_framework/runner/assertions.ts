/**
 * @module ScenarioFrameworkAssertions
 * @path tests/scenario_framework/runner/assertions.ts
 * @description Implements Step 5 criterion evaluation primitives and
 * per-step failure classification for input validation, command execution, and
 * output validation.
 * @architectural-layer Test
 * @dependencies [@std/path, @std/yaml, step_schema, step_executor]
 * @related-files [tests/scenario_framework/runner/evidence_collector.ts, tests/scenario_framework/schema/step_schema.ts, tests/scenario_framework/tests/unit/assertions_evidence_test.ts]
 */

import { globToRegExp, relative, resolve } from "@std/path";
import { levenshteinDistance } from "@std/text";
import { parse as parseYaml } from "@std/yaml";
import {
  CriterionKind,
  CriterionPhase,
  CriterionStatus,
  type ICriterion,
  type ICriterionResult,
  type IScenarioStep,
} from "../schema/step_schema.ts";
import type { IScenarioStepExecutionResult } from "./step_executor.ts";

const FRONTMATTER_PATTERN = /^---\n([\s\S]*?)\n---\n?/;
const DEFAULT_JOURNAL_FILE = "journal.ndjson";
const JSON_PATH_ROOT = "$";

export enum StepFailureStage {
  INPUT = "input",
  EXECUTION = "execution",
  OUTPUT = "output",
}

export interface IEvaluateCriterionOptions {
  workspaceRoot: string;
  phase: CriterionPhase;
  criterion: ICriterion;
  executionResult?: IScenarioStepExecutionResult;
  env?: { [key: string]: string };
  portalAliases?: string[];
}

export interface IEvaluateStepOutcomeOptions {
  workspaceRoot: string;
  step: IScenarioStep;
  executionResult?: IScenarioStepExecutionResult;
  env?: { [key: string]: string };
  portalAliases?: string[];
}

export interface IScenarioStepOutcome {
  stepId: string;
  status: CriterionStatus;
  failureStage: CriterionPhase | StepFailureStage.EXECUTION | null;
  criterionResults: ICriterionResult[];
  executionResult?: IScenarioStepExecutionResult;
}

type IFileExistsCriterion = Extract<ICriterion, { kind: CriterionKind.FILE_EXISTS }>;
type IFileFoundCriterion = Extract<ICriterion, { kind: CriterionKind.FILE_FOUND }>;
type IFileNotExistsCriterion = Extract<ICriterion, { kind: CriterionKind.FILE_NOT_EXISTS }>;
type ITextContainsCriterion = Extract<ICriterion, { kind: CriterionKind.TEXT_CONTAINS }>;
type IJsonPathExistsCriterion = Extract<ICriterion, { kind: CriterionKind.JSON_PATH_EXISTS }>;
type IJsonPathEqualsCriterion = Extract<ICriterion, { kind: CriterionKind.JSON_PATH_EQUALS }>;
type IJsonPathEqualsAnyCriterion = Extract<ICriterion, { kind: CriterionKind.JSON_PATH_EQUALS_ANY }>;
type IFrontmatterFieldExistsCriterion = Extract<ICriterion, { kind: CriterionKind.FRONTMATTER_FIELD_EXISTS }>;
type IFrontmatterFieldEqualsCriterion = Extract<ICriterion, { kind: CriterionKind.FRONTMATTER_FIELD_EQUALS }>;
type IJournalEventExistsCriterion = Extract<ICriterion, { kind: CriterionKind.JOURNAL_EVENT_EXISTS }>;
type ICommandExitCodeCriterion = Extract<ICriterion, { kind: CriterionKind.COMMAND_EXIT_CODE }>;
type IStatusEqualsCriterion = Extract<ICriterion, { kind: CriterionKind.STATUS_EQUALS }>;
type IPortalMountedCriterion = Extract<ICriterion, { kind: CriterionKind.PORTAL_MOUNTED }>;
type IEnvVarPresentCriterion = Extract<ICriterion, { kind: CriterionKind.ENV_VAR_PRESENT }>;
type ITextMatchesCriterion = Extract<ICriterion, { kind: CriterionKind.TEXT_MATCHES }>;

interface IKeyValueDocument {
  [key: string]: unknown;
}

export async function evaluateCriterion(
  options: IEvaluateCriterionOptions,
): Promise<ICriterionResult> {
  switch (options.criterion.kind) {
    case CriterionKind.FILE_EXISTS:
      return await evaluateFileExistsCriterion(options);
    case CriterionKind.FILE_FOUND:
      return await evaluateFileFoundCriterion(options);
    case CriterionKind.FILE_NOT_EXISTS:
      return await evaluateFileNotExistsCriterion(options);
    case CriterionKind.TEXT_CONTAINS:
      return await evaluateTextContainsCriterion(options);
    case CriterionKind.JSON_PATH_EXISTS:
      return await evaluateJsonPathExistsCriterion(options);
    case CriterionKind.JSON_PATH_EQUALS:
      return await evaluateJsonPathEqualsCriterion(options);
    case CriterionKind.JSON_PATH_EQUALS_ANY:
      return await evaluateJsonPathEqualsAnyCriterion(options);
    case CriterionKind.FRONTMATTER_FIELD_EXISTS:
      return await evaluateFrontmatterFieldExistsCriterion(options);
    case CriterionKind.FRONTMATTER_FIELD_EQUALS:
      return await evaluateFrontmatterFieldEqualsCriterion(options);
    case CriterionKind.JOURNAL_EVENT_EXISTS:
      return await evaluateJournalEventExistsCriterion(options);
    case CriterionKind.COMMAND_EXIT_CODE:
      return evaluateCommandExitCodeCriterion(options);
    case CriterionKind.STATUS_EQUALS:
      return evaluateStatusEqualsCriterion(options);
    case CriterionKind.PORTAL_MOUNTED:
      return evaluatePortalMountedCriterion(options);
    case CriterionKind.ENV_VAR_PRESENT:
      return evaluateEnvVarPresentCriterion(options);
    case CriterionKind.TEXT_MATCHES:
      return await evaluateTextMatchesCriterion(options);
  }
}

export async function evaluateStepOutcome(
  options: IEvaluateStepOutcomeOptions,
): Promise<IScenarioStepOutcome> {
  const inputResults = await evaluateCriteriaBatch({
    workspaceRoot: options.workspaceRoot,
    phase: CriterionPhase.INPUT,
    criteria: options.step.input_criteria,
    executionResult: options.executionResult,
    env: options.env,
    portalAliases: options.portalAliases,
  });

  if (hasFailedCriterion(inputResults)) {
    return {
      stepId: options.step.id,
      status: CriterionStatus.FAILED,
      failureStage: CriterionPhase.INPUT,
      criterionResults: inputResults,
      executionResult: options.executionResult,
    };
  }

  if ((options.executionResult?.exitCode ?? 0) !== 0) {
    return {
      stepId: options.step.id,
      status: CriterionStatus.FAILED,
      failureStage: StepFailureStage.EXECUTION,
      criterionResults: inputResults,
      executionResult: options.executionResult,
    };
  }

  const outputResults = await evaluateCriteriaBatch({
    workspaceRoot: options.workspaceRoot,
    phase: CriterionPhase.OUTPUT,
    criteria: options.step.output_criteria,
    executionResult: options.executionResult,
    env: options.env,
    portalAliases: options.portalAliases,
  });
  const criterionResults = [...inputResults, ...outputResults];

  return {
    stepId: options.step.id,
    status: hasFailedCriterion(outputResults) ? CriterionStatus.FAILED : CriterionStatus.PASSED,
    failureStage: hasFailedCriterion(outputResults) ? CriterionPhase.OUTPUT : null,
    criterionResults,
    executionResult: options.executionResult,
  };
}

interface IEvaluateCriteriaBatchOptions {
  workspaceRoot: string;
  phase: CriterionPhase;
  criteria: ICriterion[];
  executionResult?: IScenarioStepExecutionResult;
  env?: { [key: string]: string };
  portalAliases?: string[];
}

async function evaluateCriteriaBatch(
  options: IEvaluateCriteriaBatchOptions,
): Promise<ICriterionResult[]> {
  const results: ICriterionResult[] = [];

  for (const criterion of options.criteria) {
    results.push(
      await evaluateCriterion({
        workspaceRoot: options.workspaceRoot,
        phase: options.phase,
        criterion,
        executionResult: options.executionResult,
        env: options.env,
        portalAliases: options.portalAliases,
      }),
    );
  }

  return results;
}

function hasFailedCriterion(results: ICriterionResult[]): boolean {
  return results.some((result) => result.status !== CriterionStatus.PASSED);
}

async function evaluateFileExistsCriterion(
  options: IEvaluateCriterionOptions,
): Promise<ICriterionResult> {
  const criterion = options.criterion as IFileExistsCriterion;
  const evidenceRefs = buildEvidenceRefs(options.workspaceRoot, criterion.path);

  try {
    await Deno.stat(resolveCriterionPath(options.workspaceRoot, criterion.path));
    return buildPassedResult(options, evidenceRefs);
  } catch {
    return buildFailedResult(options, {
      message: `expected file to exist: ${criterion.path}`,
      evidenceRefs,
    });
  }
}

async function evaluateFileFoundCriterion(
  options: IEvaluateCriterionOptions,
): Promise<ICriterionResult> {
  const criterion = options.criterion as IFileFoundCriterion;
  const matcher = globToRegExp(criterion.path_pattern);
  for await (const filePath of walkWorkspaceFiles(options.workspaceRoot)) {
    const relativePath = relative(options.workspaceRoot, filePath);
    if (matcher.test(relativePath)) {
      return buildPassedResult(options, [relativePath]);
    }
  }

  return buildFailedResult(options, {
    message: `expected file matching pattern: ${criterion.path_pattern}`,
    expectedValue: criterion.path_pattern,
  });
}

async function evaluateFileNotExistsCriterion(
  options: IEvaluateCriterionOptions,
): Promise<ICriterionResult> {
  const criterion = options.criterion as IFileNotExistsCriterion;

  try {
    await Deno.stat(resolveCriterionPath(options.workspaceRoot, criterion.path));
    return buildFailedResult(options, {
      message: `expected file to be absent: ${criterion.path}`,
      evidenceRefs: buildEvidenceRefs(options.workspaceRoot, criterion.path),
    });
  } catch {
    return buildPassedResult(options, []);
  }
}

async function evaluateTextContainsCriterion(
  options: IEvaluateCriterionOptions,
): Promise<ICriterionResult> {
  const criterion = options.criterion as ITextContainsCriterion;
  const content = await safeReadTextFile(options.workspaceRoot, criterion.path);

  if (content === null) {
    return buildFailedResult(options, {
      message: `text file not found: ${criterion.path}`,
      evidenceRefs: buildEvidenceRefs(options.workspaceRoot, criterion.path),
    });
  }

  if (criterion.similarity_threshold !== undefined) {
    const similarity = getSimilarityScore(content, criterion.contains);
    if (similarity >= criterion.similarity_threshold) {
      return buildPassedResult(options, buildEvidenceRefs(options.workspaceRoot, criterion.path));
    }
    return buildFailedResult(options, {
      message: `text in ${criterion.path} not similar enough to: ${criterion.contains} (similarity: ${
        similarity.toFixed(2)
      }, threshold: ${criterion.similarity_threshold})`,
      expectedValue: criterion.contains,
      observedValue: content,
      evidenceRefs: buildEvidenceRefs(options.workspaceRoot, criterion.path),
    });
  }

  if (content.includes(criterion.contains)) {
    return buildPassedResult(options, buildEvidenceRefs(options.workspaceRoot, criterion.path));
  }

  return buildFailedResult(options, {
    message: `expected text in ${criterion.path}: ${criterion.contains}`,
    expectedValue: criterion.contains,
    observedValue: content,
    evidenceRefs: buildEvidenceRefs(options.workspaceRoot, criterion.path),
  });
}

async function evaluateTextMatchesCriterion(
  options: IEvaluateCriterionOptions,
): Promise<ICriterionResult> {
  const criterion = options.criterion as ITextMatchesCriterion;
  const content = await safeReadTextFile(options.workspaceRoot, criterion.path);

  if (content === null) {
    return buildFailedResult(options, {
      message: `text file not found: ${criterion.path}`,
      evidenceRefs: buildEvidenceRefs(options.workspaceRoot, criterion.path),
    });
  }

  const missingPatterns: string[] = [];
  const flags = criterion.flags || "s";
  for (const pattern of criterion.matches) {
    try {
      const regex = new RegExp(pattern, flags);
      if (!regex.test(content)) {
        missingPatterns.push(pattern);
      }
    } catch (e) {
      return buildFailedResult(options, {
        message: `invalid regex pattern: ${pattern} - ${(e as Error).message}`,
        expectedValue: pattern,
      });
    }
  }

  if (missingPatterns.length === 0) {
    return buildPassedResult(options, buildEvidenceRefs(options.workspaceRoot, criterion.path));
  }

  return buildFailedResult(options, {
    message: `text in ${criterion.path} did not match all required patterns. Missing: ${missingPatterns.join(", ")}`,
    expectedValue: criterion.matches,
    observedValue: content,
    evidenceRefs: buildEvidenceRefs(options.workspaceRoot, criterion.path),
  });
}

async function evaluateJsonPathExistsCriterion(
  options: IEvaluateCriterionOptions,
): Promise<ICriterionResult> {
  const criterion = options.criterion as IJsonPathExistsCriterion;
  const jsonDocument = await loadJsonCriterionDocument(options.workspaceRoot, criterion.target_file);
  if (jsonDocument === null) {
    return buildFailedResult(options, {
      message: `JSON target file not found: ${criterion.target_file ?? "<missing target_file>"}`,
      evidenceRefs: buildEvidenceRefs(options.workspaceRoot, criterion.target_file),
    });
  }

  const selection = readJsonPath(jsonDocument, criterion.path);
  if (selection.exists) {
    return buildPassedResult(options, buildEvidenceRefs(options.workspaceRoot, criterion.target_file));
  }

  return buildFailedResult(options, {
    message: `expected JSON path to exist: ${criterion.path}`,
    expectedValue: criterion.path,
    evidenceRefs: buildEvidenceRefs(options.workspaceRoot, criterion.target_file),
  });
}

async function evaluateJsonPathEqualsCriterion(
  options: IEvaluateCriterionOptions,
): Promise<ICriterionResult> {
  const criterion = options.criterion as IJsonPathEqualsCriterion;
  const jsonDocument = await loadJsonCriterionDocument(options.workspaceRoot, criterion.target_file);
  if (jsonDocument === null) {
    return buildFailedResult(options, {
      message: `JSON target file not found: ${criterion.target_file ?? "<missing target_file>"}`,
      expectedValue: criterion.equals,
      evidenceRefs: buildEvidenceRefs(options.workspaceRoot, criterion.target_file),
    });
  }

  const selection = readJsonPath(jsonDocument, criterion.path);
  if (selection.exists && valuesMatch(selection.value, criterion.equals, criterion.similarity_threshold)) {
    return buildPassedResult(options, buildEvidenceRefs(options.workspaceRoot, criterion.target_file));
  }

  const failureMessage = criterion.similarity_threshold !== undefined && typeof selection.value === "string" &&
      typeof criterion.equals === "string"
    ? `expected JSON path ${criterion.path} to be similar to ${
      JSON.stringify(criterion.equals)
    } (threshold: ${criterion.similarity_threshold})`
    : `expected JSON path ${criterion.path} to equal ${JSON.stringify(criterion.equals)}`;

  return buildFailedResult(options, {
    message: failureMessage,
    expectedValue: criterion.equals,
    observedValue: selection.value,
    evidenceRefs: buildEvidenceRefs(options.workspaceRoot, criterion.target_file),
  });
}

async function evaluateJsonPathEqualsAnyCriterion(
  options: IEvaluateCriterionOptions,
): Promise<ICriterionResult> {
  const criterion = options.criterion as IJsonPathEqualsAnyCriterion;
  const jsonDocument = await loadJsonCriterionDocument(options.workspaceRoot, criterion.target_file);
  if (jsonDocument === null) {
    return buildFailedResult(options, {
      message: `JSON target file not found: ${criterion.target_file ?? "<missing target_file>"}`,
      expectedValue: criterion.values,
      evidenceRefs: buildEvidenceRefs(options.workspaceRoot, criterion.target_file),
    });
  }

  const selection = readJsonPath(jsonDocument, criterion.path);
  if (selection.exists && criterion.values.some((value) => valuesMatch(selection.value, value))) {
    return buildPassedResult(options, buildEvidenceRefs(options.workspaceRoot, criterion.target_file));
  }

  return buildFailedResult(options, {
    message: `expected JSON path ${criterion.path} to equal one of ${JSON.stringify(criterion.values)}`,
    expectedValue: criterion.values,
    observedValue: selection.value,
    evidenceRefs: buildEvidenceRefs(options.workspaceRoot, criterion.target_file),
  });
}

async function evaluateFrontmatterFieldExistsCriterion(
  options: IEvaluateCriterionOptions,
): Promise<ICriterionResult> {
  const criterion = options.criterion as IFrontmatterFieldExistsCriterion;
  const frontmatter = await loadFrontmatterDocument(options.workspaceRoot, criterion.target_file);
  if (frontmatter === null) {
    return buildFailedResult(options, {
      message: `frontmatter target file not found: ${criterion.target_file ?? "<missing target_file>"}`,
      evidenceRefs: buildEvidenceRefs(options.workspaceRoot, criterion.target_file),
    });
  }

  if (Object.hasOwn(frontmatter, criterion.field)) {
    return buildPassedResult(options, buildEvidenceRefs(options.workspaceRoot, criterion.target_file));
  }

  return buildFailedResult(options, {
    message: `expected frontmatter field to exist: ${criterion.field}`,
    expectedValue: criterion.field,
    evidenceRefs: buildEvidenceRefs(options.workspaceRoot, criterion.target_file),
  });
}

async function evaluateFrontmatterFieldEqualsCriterion(
  options: IEvaluateCriterionOptions,
): Promise<ICriterionResult> {
  const criterion = options.criterion as IFrontmatterFieldEqualsCriterion;
  const frontmatter = await loadFrontmatterDocument(options.workspaceRoot, criterion.target_file);
  if (frontmatter === null) {
    return buildFailedResult(options, {
      message: `frontmatter target file not found: ${criterion.target_file ?? "<missing target_file>"}`,
      expectedValue: criterion.equals,
      evidenceRefs: buildEvidenceRefs(options.workspaceRoot, criterion.target_file),
    });
  }

  const observedValue = frontmatter[criterion.field];
  if (valuesMatch(observedValue, criterion.equals, criterion.similarity_threshold)) {
    return buildPassedResult(options, buildEvidenceRefs(options.workspaceRoot, criterion.target_file));
  }

  return buildFailedResult(options, {
    message: `expected frontmatter field ${criterion.field} to equal ${JSON.stringify(criterion.equals)}`,
    expectedValue: criterion.equals,
    observedValue,
    evidenceRefs: buildEvidenceRefs(options.workspaceRoot, criterion.target_file),
  });
}

async function evaluateJournalEventExistsCriterion(
  options: IEvaluateCriterionOptions,
): Promise<ICriterionResult> {
  const criterion = options.criterion as IJournalEventExistsCriterion;
  const journalFile = criterion.journal_file ?? DEFAULT_JOURNAL_FILE;
  const content = await safeReadTextFile(options.workspaceRoot, journalFile);
  if (content === null) {
    return buildFailedResult(options, {
      message: `journal file not found: ${journalFile}`,
      evidenceRefs: buildEvidenceRefs(options.workspaceRoot, journalFile),
    });
  }

  for (const line of content.split("\n")) {
    if (line.trim().length === 0) {
      continue;
    }

    const eventRecord = JSON.parse(line) as { event_type?: string };
    if (eventRecord.event_type === criterion.event_type) {
      return buildPassedResult(options, buildEvidenceRefs(options.workspaceRoot, journalFile));
    }
  }

  return buildFailedResult(options, {
    message: `expected journal event type: ${criterion.event_type}`,
    expectedValue: criterion.event_type,
    evidenceRefs: buildEvidenceRefs(options.workspaceRoot, journalFile),
  });
}

function evaluateCommandExitCodeCriterion(
  options: IEvaluateCriterionOptions,
): ICriterionResult {
  const criterion = options.criterion as ICommandExitCodeCriterion;
  const observedValue = options.executionResult?.exitCode;
  if (observedValue === criterion.equals) {
    return buildPassedResult(options, []);
  }

  return buildFailedResult(options, {
    message: `expected exit code ${criterion.equals} but received ${String(observedValue)}`,
    expectedValue: criterion.equals,
    observedValue,
  });
}

function evaluateStatusEqualsCriterion(
  options: IEvaluateCriterionOptions,
): ICriterionResult {
  const criterion = options.criterion as IStatusEqualsCriterion;
  const observedValue = options.executionResult?.stdout.trim() ?? "";
  if (observedValue === criterion.equals) {
    return buildPassedResult(options, []);
  }

  return buildFailedResult(options, {
    message: `expected status ${criterion.equals} but received ${observedValue}`,
    expectedValue: criterion.equals,
    observedValue,
  });
}

function evaluatePortalMountedCriterion(
  options: IEvaluateCriterionOptions,
): ICriterionResult {
  const criterion = options.criterion as IPortalMountedCriterion;
  const isMounted = options.portalAliases?.includes(criterion.alias) ?? false;
  if (isMounted) {
    return buildPassedResult(options, []);
  }

  return buildFailedResult(options, {
    message: `expected mounted portal alias: ${criterion.alias}`,
    expectedValue: criterion.alias,
  });
}

function evaluateEnvVarPresentCriterion(
  options: IEvaluateCriterionOptions,
): ICriterionResult {
  const criterion = options.criterion as IEnvVarPresentCriterion;
  const envValue = options.env?.[criterion.env_var] ?? Deno.env.get(criterion.env_var) ?? null;
  if (envValue !== null && envValue.length > 0) {
    return buildPassedResult(options, []);
  }

  return buildFailedResult(options, {
    message: `expected env var to be present: ${criterion.env_var}`,
    expectedValue: criterion.env_var,
  });
}

interface ICriterionResultBuildOptions {
  message: string;
  evidenceRefs?: string[];
  observedValue?: unknown;
  expectedValue?: unknown;
}

function buildPassedResult(
  options: IEvaluateCriterionOptions,
  evidenceRefs: string[],
): ICriterionResult {
  return {
    criterion_id: options.criterion.id,
    kind: options.criterion.kind,
    phase: options.phase,
    status: CriterionStatus.PASSED,
    message: options.criterion.message ?? `${options.criterion.id} passed`,
    evidence_refs: evidenceRefs,
  };
}

function buildFailedResult(
  options: IEvaluateCriterionOptions,
  failure: ICriterionResultBuildOptions,
): ICriterionResult {
  return {
    criterion_id: options.criterion.id,
    kind: options.criterion.kind,
    phase: options.phase,
    status: CriterionStatus.FAILED,
    message: failure.message,
    evidence_refs: failure.evidenceRefs ?? [],
    observed_value: failure.observedValue,
    expected_value: failure.expectedValue,
  };
}

function resolveCriterionPath(workspaceRoot: string, relativePath: string): string {
  const resolvedPath = resolve(workspaceRoot, relativePath);
  const workspacePrefix = `${resolve(workspaceRoot)}/`;
  if (resolvedPath !== resolve(workspaceRoot) && !resolvedPath.startsWith(workspacePrefix)) {
    throw new Error(`criterion path escapes workspace root: ${relativePath}`);
  }

  return resolvedPath;
}

function buildEvidenceRefs(workspaceRoot: string, relativePath?: string): string[] {
  if (!relativePath) {
    return [];
  }

  const resolvedPath = resolveCriterionPath(workspaceRoot, relativePath);
  try {
    Deno.statSync(resolvedPath);
    return [relativePath];
  } catch {
    return [];
  }
}

async function safeReadTextFile(workspaceRoot: string, relativePath: string): Promise<string | null> {
  try {
    return await Deno.readTextFile(resolveCriterionPath(workspaceRoot, relativePath));
  } catch {
    return null;
  }
}

async function loadJsonCriterionDocument(
  workspaceRoot: string,
  targetFile?: string,
): Promise<unknown | null> {
  if (!targetFile) {
    return null;
  }

  const content = await safeReadTextFile(workspaceRoot, targetFile);
  return content === null ? null : JSON.parse(content);
}

async function loadFrontmatterDocument(
  workspaceRoot: string,
  targetFile?: string,
): Promise<IKeyValueDocument | null> {
  if (!targetFile) {
    return null;
  }

  const content = await safeReadTextFile(workspaceRoot, targetFile);
  if (content === null) {
    return null;
  }

  const frontmatterMatch = content.match(FRONTMATTER_PATTERN);
  if (!frontmatterMatch) {
    return {};
  }

  const parsedFrontmatter = parseYaml(frontmatterMatch[1]);
  if (parsedFrontmatter === null || typeof parsedFrontmatter !== "object" || Array.isArray(parsedFrontmatter)) {
    return {};
  }

  return parsedFrontmatter as IKeyValueDocument;
}

interface IJsonPathSelection {
  exists: boolean;
  value?: unknown;
}

function readJsonPath(document: unknown, jsonPath: string): IJsonPathSelection {
  if (jsonPath === JSON_PATH_ROOT) {
    return {
      exists: true,
      value: document,
    };
  }

  if (!jsonPath.startsWith(`${JSON_PATH_ROOT}.`)) {
    return { exists: false };
  }

  const tokens = jsonPath
    .slice(2)
    .replaceAll("[", ".")
    .replaceAll("]", "")
    .split(".")
    .filter((token) => token.length > 0);

  let cursor: unknown = document;
  for (const token of tokens) {
    if (Array.isArray(cursor)) {
      const index = Number(token);
      if (!Number.isInteger(index) || index < 0 || index >= cursor.length) {
        return { exists: false };
      }
      cursor = cursor[index];
      continue;
    }

    if (cursor === null || typeof cursor !== "object" || !Object.hasOwn(cursor, token)) {
      return { exists: false };
    }

    cursor = (cursor as IKeyValueDocument)[token];
  }

  return {
    exists: true,
    value: cursor,
  };
}

function valuesMatch(left: unknown, right: unknown, similarityThreshold?: number): boolean {
  if (similarityThreshold !== undefined && typeof left === "string" && typeof right === "string") {
    return getSimilarityScore(left, right) >= similarityThreshold;
  }
  return JSON.stringify(left) === JSON.stringify(right);
}

function getSimilarityScore(a: string, b: string): number {
  if (a.length === 0 && b.length === 0) return 1;
  const distance = levenshteinDistance(a, b);
  return 1 - (distance / Math.max(a.length, b.length));
}

async function* walkWorkspaceFiles(workspaceRoot: string): AsyncGenerator<string> {
  for await (const entry of Deno.readDir(workspaceRoot)) {
    const entryPath = resolve(workspaceRoot, entry.name);
    if (entry.isDirectory) {
      yield* walkWorkspaceFiles(entryPath);
      continue;
    }

    if (entry.isFile) {
      yield entryPath;
    }
  }
}
