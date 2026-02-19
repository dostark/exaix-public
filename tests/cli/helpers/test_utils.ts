/**
 * CLI Test Utilities
 */

/**
 * Reusable helper to import exoctl module with test mode enabled.
 * Note: If you need to mock specific commands, you can use the returned ctx.
 */
import type { ExoCtlTestContext } from "../../../src/cli/exoctl.ts";

const mod = await import("../../../src/cli/exoctl.ts");
export async function withTestMod<T>(fn: (mod: any, ctx: ExoCtlTestContext) => Promise<T> | T) {
  const origEnv = Deno.env.get("EXO_TEST_CLI_MODE") ?? Deno.env.get("EXO_TEST_MODE");
  Deno.env.set("EXO_TEST_CLI_MODE", "1");
  Deno.env.set("EXO_TEST_MODE", "1");
  try {
    const ctx = mod.__test_getContext();
    return await fn(mod, ctx);
  } finally {
    if (origEnv === undefined) {
      Deno.env.delete("EXO_TEST_CLI_MODE");
      Deno.env.delete("EXO_TEST_MODE");
    } else {
      Deno.env.set("EXO_TEST_CLI_MODE", origEnv);
      Deno.env.set("EXO_TEST_MODE", origEnv);
    }
  }
}

/**
 * Helper to run a function with a timeout.
 */
async function runWithTimeout<T>(
  fn: () => Promise<T> | T,
  timeoutMs: number,
  timeoutMessage: string = `Test operation timed out after ${timeoutMs}ms`,
): Promise<T> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await Promise.race([
      Promise.resolve(fn()),
      new Promise<never>((_, reject) => {
        controller.signal.addEventListener("abort", () => {
          reject(new Error(timeoutMessage));
        });
      }),
    ]);
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Captures console.log output during the execution of a function.
 */
export async function captureConsoleOutput(fn: () => Promise<void> | void, timeoutMs: number = 10000) {
  let out = "";
  const origLog = console.log;
  console.log = (msg: string) => (out += msg + "\n");

  try {
    await runWithTimeout(fn, timeoutMs);
  } finally {
    console.log = origLog;
  }
  return out;
}

/**
 * Captures all console outputs (log, warn, error) during the execution of a function.
 */
export async function captureAllOutputs(fn: () => Promise<void> | void, timeoutMs: number = 10000) {
  const logs: string[] = [];
  const warns: string[] = [];
  const errs: string[] = [];
  const origLog = console.log;
  const origWarn = console.warn;
  const origErr = console.error;
  console.log = (...args: any[]) => logs.push(args.join(" "));
  console.warn = (...args: any[]) => warns.push(args.join(" "));
  console.error = (...args: any[]) => errs.push(args.join(" "));

  try {
    await runWithTimeout(fn, timeoutMs);
  } finally {
    console.log = origLog;
    console.warn = origWarn;
    console.error = origErr;
  }
  return { logs, warns, errs };
}

/**
 * Expects the function to call Deno.exit and captures the console.error output.
 */
export async function expectExitWithLogs(
  fn: () => Promise<void> | void,
  timeoutMs: number = 10000,
): Promise<{ err: any; errors: string[]; exitCalled: boolean }> {
  const origExit = Deno.exit;
  const origErr = console.error;
  const errors: string[] = [];
  let exitCalled = false;
  console.error = (...args: any[]) => errors.push(args.join(" "));
  (Deno as any).exit = (code?: number) => {
    exitCalled = true;
    throw new Error(`DENO_EXIT:${code ?? 0}`);
  };

  try {
    await runWithTimeout(async () => {
      await fn();
      throw new Error("Expected Deno.exit to be called");
    }, timeoutMs);
  } catch (e: any) {
    if (!e.message.startsWith("DENO_EXIT:") && !e.message.includes("timed out")) throw e;
    return { err: e, errors, exitCalled };
  } finally {
    console.error = origErr;
    Deno.exit = origExit;
  }
  // This should never be reached, but TypeScript requires it
  throw new Error("Unexpected code path in expectExitWithLogs");
}
