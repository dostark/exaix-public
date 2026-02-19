import { assertEquals } from "@std/assert";
import { TEST_MODEL_ANTHROPIC, TEST_PROVIDER_ID_ANTHROPIC } from "../config/constants.ts";
import { handleRequestShow, type RequestActionContext } from "../../src/cli/command_builders/request_actions.ts";
import type { RequestCommands } from "../../src/cli/commands/request_commands.ts";
import { EventLogger, type EventLoggerConfig } from "../../src/services/event_logger.ts";
import { LogLevel } from "../../src/enums.ts";

class MockEventLogger extends EventLogger {
  public calls: Array<{ level: LogLevel; a: string; b: string; c: any }> = [];

  constructor() {
    super({ minLevel: LogLevel.DEBUG } as EventLoggerConfig);
  }

  override info(action: string, target: string, payload?: Record<string, unknown>): Promise<void> {
    this.calls.push({ level: LogLevel.INFO, a: action, b: target, c: payload });
    return Promise.resolve();
  }

  override error(action: string, target: string, payload?: Record<string, unknown>): Promise<void> {
    this.calls.push({ level: LogLevel.ERROR, a: action, b: target, c: payload });
    return Promise.resolve();
  }
}

function createDisplay() {
  const display = new MockEventLogger();
  return { display, calls: display.calls };
}

Deno.test("handleRequestShow: includes token stats when present", async () => {
  const { display, calls } = createDisplay();
  const requestCommands = {
    show: () =>
      Promise.resolve({
        metadata: {
          trace_id: "trace-1",
          status: "planned",
          priority: "normal",
          agent: "agent",
          created_by: "tester",
          created: "time",
          input_tokens: 200,
          output_tokens: 80,
          total_tokens: 280,
          token_provider: TEST_PROVIDER_ID_ANTHROPIC,
          token_model: TEST_MODEL_ANTHROPIC,
          token_cost_usd: 0.0042,
        },
        content: "Hello world",
      }),
  };

  const context: RequestActionContext = {
    requestCommands: requestCommands as unknown as RequestCommands,
    display,
  };
  await handleRequestShow(context, "trace-1");

  assertEquals(calls.length, 2);
  assertEquals(calls[0].a, "request.show");
  assertEquals(calls[0].c.input_tokens, 200);
  assertEquals(calls[0].c.output_tokens, 80);
  assertEquals(calls[0].c.total_tokens, 280);
  assertEquals(calls[0].c.token_provider, TEST_PROVIDER_ID_ANTHROPIC);
  assertEquals(calls[0].c.token_model, TEST_MODEL_ANTHROPIC);
  assertEquals(calls[0].c.token_cost_usd, 0.0042);
  assertEquals(calls[1].a, "request.content");
});
