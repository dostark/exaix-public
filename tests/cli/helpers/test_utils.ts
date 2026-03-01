/**
 * @module CliTestUtilities
 * @path tests/cli/helpers/test_utils.ts
 * @description Shared testing utilities for CLI commands, including context setup and output capture.
 */

import type { ExoCtlTestContext } from "../../../src/cli/exoctl.ts";
import type * as ExoCtlModule from "../../../src/cli/exoctl.ts";
import { join } from "@std/path";
import { ensureDir } from "@std/fs";

// Dynamic import required for test module loading (documented in CODE_STYLE.md)
// This must remain a dynamic import because the module is only needed at runtime in test mode.
const exoctlModulePromise: Promise<typeof import("../../../src/cli/exoctl.ts")> = import("../../../src/cli/exoctl.ts");

function loadExoCtlModule(): Promise<typeof import("../../../src/cli/exoctl.ts")> {
  return exoctlModulePromise;
}

export async function withTestMod<T>(fn: (mod: typeof ExoCtlModule, ctx: ExoCtlTestContext) => Promise<T> | T) {
  const origEnv = Deno.env.get("EXO_TEST_CLI_MODE") ?? Deno.env.get("EXO_TEST_MODE");
  Deno.env.set("EXO_TEST_CLI_MODE", "1");
  Deno.env.set("EXO_TEST_MODE", "1");
  let ctx: ExoCtlTestContext | undefined;
  const tempDir: string = await Deno.makeTempDir({ prefix: "exo-test-" });
  await ensureDir(tempDir);
  const configPath: string = join(tempDir, "exo.config.toml");
  const configContent = `
[system]
root = "./"

[paths]
runtime = "./.exo"

[database]
batch_flush_ms = 10
batch_max_size = 10
sqlite.journal_mode = "WAL"
sqlite.foreign_keys = true
sqlite.busy_timeout_ms = 5000

[agents]
default_model = "mock:test"
`;
  await Deno.writeTextFile(configPath, configContent);
  // Set EXO_CONFIG_PATH before any CLI code loads
  Deno.env.set("EXO_CONFIG_PATH", configPath);
  try {
    const loadedMod = await loadExoCtlModule();
    // Use real DB in test mode if possible
    if (loadedMod.__test_initializeServices) {
      const services = await loadedMod.__test_initializeServices({ instantiateDb: true, configPath });
      ctx = {
        ...loadedMod.__test_getContext(),
        db: services.db,
      };
    } else {
      ctx = loadedMod.__test_getContext();
    }
    return await fn(loadedMod, ctx);
  } finally {
    // Attempt to close db and underlying dynamic library if present
    if (ctx && ctx.db) {
      // Close the DatabaseService
      if (typeof ctx.db.close === "function") {
        try {
          await ctx.db.close();
        } catch (err) {
          console.error("[withTestMod] Error closing db:", err);
        }
      }
      // Close the underlying Database instance if present
      const dbAny = ctx.db as unknown;
      if (
        dbAny &&
        typeof dbAny === "object" &&
        "instance" in dbAny &&
        typeof (dbAny as { instance?: unknown }).instance === "object" &&
        typeof (dbAny as { instance?: { close?: unknown } }).instance?.close === "function"
      ) {
        try {
          await (dbAny as { instance: { close: () => Promise<void> } }).instance.close();
        } catch (err) {
          console.error("[withTestMod] Error closing db.instance:", err);
        }
      }
    }
    if (origEnv === undefined) {
      Deno.env.delete("EXO_TEST_CLI_MODE");
      Deno.env.delete("EXO_TEST_MODE");
    } else {
      Deno.env.set("EXO_TEST_CLI_MODE", origEnv);
      Deno.env.set("EXO_TEST_MODE", origEnv);
    }
    if (configPath) {
      Deno.env.delete("EXO_CONFIG_PATH");
    }
    // Clean up ephemeral config and temp dir
    if (tempDir) {
      try {
        await Deno.remove(tempDir, { recursive: true });
      } catch (_) {
        // ignore errors during temp dir cleanup
      }
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
  console.log = (...args: string[]) => logs.push(args.map(String).join(" "));
  console.warn = (...args: string[]) => warns.push(args.map(String).join(" "));
  console.error = (...args: string[]) => errs.push(args.map(String).join(" "));

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
): Promise<{ err: Error; errors: string[]; exitCalled: boolean }> {
  const origExit = Deno.exit;
  const origErr = console.error;
  const errors: string[] = [];
  let exitCalled = false;
  console.error = (...args: string[]) => errors.push(args.map(String).join(" "));
  Deno.exit = (code?: number) => {
    exitCalled = true;
    throw new Error(`DENO_EXIT:${code ?? 0}`);
  };

  try {
    await runWithTimeout(async () => {
      await fn();
      throw new Error("Expected Deno.exit to be called");
    }, timeoutMs);
  } catch (e: unknown) {
    if (e instanceof Error) {
      if (!e.message.startsWith("DENO_EXIT:") && !e.message.includes("timed out")) throw e;
      return { err: e, errors, exitCalled };
    }
    throw e;
  } finally {
    console.error = origErr;
    Deno.exit = origExit;
  }
  // This should never be reached, but TypeScript requires it
  throw new Error("Unexpected code path in expectExitWithLogs");
}
