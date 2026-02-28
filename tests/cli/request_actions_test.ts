/**
 * @module RequestActionsTest
 * @path tests/cli/request_actions_test.ts
 * @description Verifies CLI presentation logic for agent requests, ensuring detailed views
 * correctly include trace_id, agent assignments, and token usage statistics.
 */

import { assertEquals } from "@std/assert";
import { TEST_MODEL_ANTHROPIC, TEST_PROVIDER_ID_ANTHROPIC } from "../shared/constants.ts";
import { handleRequestShow, type IRequestActionContext } from "../../src/cli/command_builders/request_actions.ts";
import { RequestCommands } from "../../src/cli/commands/request_commands.ts";
import { EventLogger, type IEventLoggerConfig } from "../../src/services/event_logger.ts";

import { LogLevel } from "../../src/shared/enums.ts";

type TestPayload = {
  input_tokens?: number;
  output_tokens?: number;
  total_tokens?: number;
  token_provider?: string;
  token_model?: string;
  token_cost_usd?: number;
  [key: string]: unknown;
};

class MockEventLogger extends EventLogger {
  public calls: Array<{ level: LogLevel; a: string; b: string; c: TestPayload | undefined }> = [];

  constructor() {
    super({ minLevel: LogLevel.DEBUG } as IEventLoggerConfig);
  }

  override info(action: string, target: string, payload?: TestPayload): Promise<void> {
    this.calls.push({ level: LogLevel.INFO, a: action, b: target, c: payload });
    return Promise.resolve();
  }

  override error(action: string, target: string, payload?: TestPayload): Promise<void> {
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

  const context: IRequestActionContext = {
    requestCommands: Object.assign(Object.create(RequestCommands.prototype), requestCommands),
    display,
  };
  await handleRequestShow(context, "trace-1");

  assertEquals(calls.length, 2);
  assertEquals(calls[0].a, "request.show");
  if (calls[0].c) {
    assertEquals(calls[0].c.input_tokens, 200);
    assertEquals(calls[0].c.output_tokens, 80);
    assertEquals(calls[0].c.total_tokens, 280);
    assertEquals(calls[0].c.token_provider, TEST_PROVIDER_ID_ANTHROPIC);
    assertEquals(calls[0].c.token_model, TEST_MODEL_ANTHROPIC);
    assertEquals(calls[0].c.token_cost_usd, 0.0042);
  } else {
    throw new Error("calls[0].c is undefined");
  }
  assertEquals(calls[1].a, "request.content");
});
