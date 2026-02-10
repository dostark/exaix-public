import { assertEquals } from "@std/assert";
import { handleRequestShow } from "../../src/cli/command_builders/request_actions.ts";

function createDisplay() {
  const calls: Array<{ level: "info" | "error"; a: string; b: string; c: any }> = [];
  const display = {
    info: (a: string, b: string, c: any) => calls.push({ level: "info", a, b, c }),
    error: (a: string, b: string, c: any) => calls.push({ level: "error", a, b, c }),
  };
  return { display, calls };
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
          token_provider: "anthropic-claude-3-5",
          token_model: "claude-3-5-sonnet",
          token_cost_usd: 0.0042,
        },
        content: "Hello world",
      }),
  };

  await handleRequestShow({ requestCommands: requestCommands as any, display }, "trace-1");

  assertEquals(calls.length, 2);
  assertEquals(calls[0].a, "request.show");
  assertEquals(calls[0].c.input_tokens, 200);
  assertEquals(calls[0].c.output_tokens, 80);
  assertEquals(calls[0].c.total_tokens, 280);
  assertEquals(calls[0].c.token_provider, "anthropic-claude-3-5");
  assertEquals(calls[0].c.token_model, "claude-3-5-sonnet");
  assertEquals(calls[0].c.token_cost_usd, 0.0042);
  assertEquals(calls[1].a, "request.content");
});
