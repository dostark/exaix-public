/**
 * CLI Test Utilities
 */

/**
 * Reusable helper to import exoctl module with test mode enabled.
 * Note: If you need to mock specific commands, you can use the returned ctx.
 */
export async function withTestMod<T>(fn: (mod: any, ctx: any) => Promise<T> | T) {
  const origEnv = Deno.env.get("EXO_TEST_CLI_MODE") ?? Deno.env.get("EXO_TEST_MODE");
  Deno.env.set("EXO_TEST_CLI_MODE", "1");
  Deno.env.set("EXO_TEST_MODE", "1");
  try {
    // Note: use dynamic import and bypass cache if needed by appending a query string
    // but usually in Deno tests we just import it.
    // We use a relative path from the perspective of the file that will use this.
    // However, since this utility will be in tests/cli/helpers, we need to go up.
    const mod = await import("../../../src/cli/exoctl.ts");
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
 * Captures console.log output during the execution of a function.
 */
export async function captureConsoleOutput(fn: () => Promise<void> | void, timeoutMs: number = 10000) {
  let out = "";
  const origLog = console.log;
  console.log = (msg: string) => (out += msg + "\n");

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    await Promise.race([
      fn(),
      new Promise<never>((_, reject) => {
        controller.signal.addEventListener("abort", () => {
          reject(new Error(`Test operation timed out after ${timeoutMs}ms`));
        });
      }),
    ]);
  } finally {
    clearTimeout(timeoutId);
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

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    await Promise.race([
      fn(),
      new Promise<never>((_, reject) => {
        controller.signal.addEventListener("abort", () => {
          reject(new Error(`Test operation timed out after ${timeoutMs}ms`));
        });
      }),
    ]);
  } finally {
    clearTimeout(timeoutId);
    console.log = origLog;
    console.warn = origWarn;
    console.error = origErr;
  }
  return { logs, warns, errs };
}

/**
 * Expects the function to call Deno.exit and captures the console.error output.
 */
export async function expectExitWithLogs(fn: () => Promise<void> | void, timeoutMs: number = 10000) {
  const origExit = Deno.exit;
  const origErr = console.error;
  const errors: string[] = [];
  console.error = (...args: any[]) => errors.push(args.join(" "));
  (Deno as any).exit = (code?: number) => {
    throw new Error(`DENO_EXIT:${code ?? 0}`);
  };

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    await Promise.race([
      fn(),
      new Promise<never>((_, reject) => {
        controller.signal.addEventListener("abort", () => {
          reject(new Error(`Test operation timed out after ${timeoutMs}ms`));
        });
      }),
    ]);
    throw new Error("Expected Deno.exit to be called");
  } catch (e: any) {
    if (!e.message.startsWith("DENO_EXIT:") && !e.message.includes("timed out")) throw e;
    return { err: e, errors };
  } finally {
    clearTimeout(timeoutId);
    console.error = origErr;
    Deno.exit = origExit;
  }
}
