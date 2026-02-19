import { assertEquals } from "@std/assert";
import { LogMethod } from "../../src/services/decorators/logging.ts";
import type { EventLogger } from "../../src/services/event_logger.ts";
import { LogLevel } from "../../src/enums.ts";

type LoggedCall = {
  level: LogLevel;
  action: string;
  target: string;
  payload: Record<string, unknown>;
};

function createStubLogger(calls: LoggedCall[]): EventLogger {
  const logger = {
    debug: (action: string, target: string, payload: Record<string, unknown>) => {
      calls.push({ level: LogLevel.DEBUG, action, target, payload });
      return Promise.resolve();
    },
    info: (action: string, target: string, payload: Record<string, unknown>) => {
      calls.push({ level: LogLevel.INFO, action, target, payload });
      return Promise.resolve();
    },
    error: (action: string, target: string, payload: Record<string, unknown>) => {
      calls.push({ level: LogLevel.ERROR, action, target, payload });
      return Promise.resolve();
    },
  };

  return logger as unknown as EventLogger;
}

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
