/**
 * @module ScenarioFrameworkStepExecutor
 * @path tests/scenario_framework/runner/step_executor.ts
 * @description Executes individual scenario steps for the initial Step 3
 * execution core, capturing stdout, stderr, exit code, timestamps, and
 * combined output for shell and exoctl step kinds.
 * @architectural-layer Test
 * @dependencies [step_schema]
 * @related-files [tests/scenario_framework/runner/config.ts, tests/scenario_framework/tests/unit/scenario_loader_execution_core_test.ts]
 */

import { type IScenarioStep, ScenarioStepType } from "../schema/step_schema.ts";

export interface IExecuteScenarioStepOptions {
  step: IScenarioStep;
  exoctlExecutable?: string;
  cwd?: string;
  env?: { [key: string]: string };
}

export interface IScenarioStepExecutionResult {
  stepId: string;
  stepType: IScenarioStep["type"];
  startedAt: string;
  completedAt: string;
  durationMs: number;
  exitCode: number;
  stdout: string;
  stderr: string;
  combinedOutput: string;
}

const TEXT_DECODER = new TextDecoder();
const WHITESPACE_PATTERN = /\s+/;

export async function executeScenarioStep(
  options: IExecuteScenarioStepOptions,
): Promise<IScenarioStepExecutionResult> {
  const startedAtEpochMs = Date.now();
  const startedAt = new Date(startedAtEpochMs).toISOString();
  const commandSpec = buildCommandSpec(options);

  const output = await new Deno.Command(commandSpec.executable, {
    args: commandSpec.args,
    cwd: options.cwd,
    env: options.env,
    stdout: "piped",
    stderr: "piped",
  }).output();

  const completedAtEpochMs = Date.now();
  const completedAt = new Date(completedAtEpochMs).toISOString();
  const stdout = TEXT_DECODER.decode(output.stdout);
  const stderr = TEXT_DECODER.decode(output.stderr);

  return {
    stepId: options.step.id,
    stepType: options.step.type,
    startedAt,
    completedAt,
    durationMs: completedAtEpochMs - startedAtEpochMs,
    exitCode: output.code,
    stdout,
    stderr,
    combinedOutput: `${stdout}${stderr}`,
  };
}

interface ICommandSpec {
  executable: string;
  args: string[];
}

function buildCommandSpec(options: IExecuteScenarioStepOptions): ICommandSpec {
  if (options.step.type === ScenarioStepType.SHELL) {
    if (!options.step.command) {
      throw new Error(`shell step requires a command: ${options.step.id}`);
    }

    return {
      executable: options.step.command,
      args: options.step.args ?? [],
    };
  }

  if (options.step.type === ScenarioStepType.EXOCTL) {
    if (!options.step.command) {
      throw new Error(`exoctl step requires a command: ${options.step.id}`);
    }

    return {
      executable: options.exoctlExecutable ?? "exoctl",
      args: [...tokenizeCommand(options.step.command), ...(options.step.args ?? [])],
    };
  }

  throw new Error(`unsupported step type for execution core: ${options.step.type}`);
}

function tokenizeCommand(command: string): string[] {
  return command.split(WHITESPACE_PATTERN).filter((token) => token.length > 0);
}
