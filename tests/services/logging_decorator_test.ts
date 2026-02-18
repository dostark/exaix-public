import { assertEquals, assertRejects } from "@std/assert";
import { LogMethod } from "../../src/services/decorators/logging.ts";
import type { EventLogger } from "../../src/services/event_logger.ts";

type LoggedCall = {
  level: "debug" | "info" | "error";
  action: string;
  target: string;
  payload: Record<string, unknown>;
};

function createStubLogger(calls: LoggedCall[]): EventLogger {
  const logger = {
    debug: (action: string, target: string, payload: Record<string, unknown>) => {
      calls.push({ level: "debug", action, target, payload });
      return Promise.resolve();
    },
    info: (action: string, target: string, payload: Record<string, unknown>) => {
      calls.push({ level: "info", action, target, payload });
      return Promise.resolve();
    },
    error: (action: string, target: string, payload: Record<string, unknown>) => {
      calls.push({ level: "error", action, target, payload });
      return Promise.resolve();
    },
  };

  return logger as unknown as EventLogger;
}

Deno.test("LogMethod (experimental decorator): wraps method and logs start/completion", async () => {
  const calls: LoggedCall[] = [];
  const logger = createStubLogger(calls);

  const original = function (this: any, value: string) {
    return Promise.resolve(`ok:${value}`);
  };

  const descriptor: PropertyDescriptor = { value: original };
  const decorated = LogMethod(logger)(() => {}, "doIt", descriptor) as PropertyDescriptor;

  const out = await (decorated.value as any).call({ constructor: { name: "C" } }, "x");
  assertEquals(out, "ok:x");

  assertEquals(calls[0].level, "debug");
  assertEquals(calls[0].action, "C.doIt");
  assertEquals(calls[0].target, "started");

  assertEquals(calls[1].level, "info");
  assertEquals(calls[1].action, "C.doIt");
  assertEquals(calls[1].target, "completed");
});

Deno.test("LogMethod (experimental decorator): logs failure and rethrows", async () => {
  const calls: LoggedCall[] = [];
  const logger = createStubLogger(calls);

  const original = function () {
    throw new Error("boom");
  };

  const descriptor: PropertyDescriptor = { value: original };
  const decorated = LogMethod(logger)(() => {}, "doIt", descriptor) as PropertyDescriptor;

  await assertRejects(
    () => (decorated.value as any).call({ constructor: { name: "C" } }),
    Error,
    "boom",
  );

  assertEquals(calls[0].level, "debug");
  assertEquals(calls[1].level, "error");
  assertEquals(calls[1].action, "C.doIt");
  assertEquals(calls[1].target, "failed");
});

Deno.test("LogMethod (standard decorator): wraps method via (value, context)", async () => {
  const calls: LoggedCall[] = [];
  const logger = createStubLogger(calls);

  const original = function (this: any, value: string) {
    return Promise.resolve(`ok:${value}`);
  };

  const context = { kind: "method", name: "doIt" } as any;
  const wrapped = LogMethod(logger)(original, context) as (...args: unknown[]) => Promise<unknown>;

  const out = await wrapped.call({ constructor: { name: "C" } }, "x");
  assertEquals(out, "ok:x");
  assertEquals(calls[0].action, "C.doIt");
  assertEquals(calls[1].target, "completed");
});
