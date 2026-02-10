import { assertEquals } from "@std/assert";
import {
  handlePlanApprove,
  handlePlanList,
  handlePlanReject,
  handlePlanRevise,
  handlePlanShow,
} from "../../src/cli/command_builders/plan_actions.ts";

function createDisplay() {
  const calls: Array<{ level: "info" | "error"; a: string; b: string; c: any }> = [];
  const display = {
    info: (a: string, b: string, c: any) => calls.push({ level: "info", a, b, c }),
    error: (a: string, b: string, c: any) => calls.push({ level: "error", a, b, c }),
  };
  return { display, calls };
}

Deno.test("handlePlanList: displays empty result", async () => {
  const { display, calls } = createDisplay();
  const planCommands = {
    list: () => Promise.resolve([]),
  };

  await handlePlanList({ planCommands: planCommands as any, display }, { status: "review" });

  assertEquals(calls.length, 1);
  assertEquals(calls[0].a, "plan.list");
  assertEquals(calls[0].c.count, 0);
});

Deno.test("handlePlanList: displays plan rows with truncation", async () => {
  const { display, calls } = createDisplay();
  const longTitle = "x".repeat(60);
  const planCommands = {
    list: () =>
      Promise.resolve([
        {
          id: "p1",
          status: "review",
          trace_id: "1234567890abcdef",
          request_title: longTitle,
          request_agent: "agent",
          request_portal: "portal",
          request_priority: "p",
        },
      ]),
  };

  await handlePlanList({ planCommands: planCommands as any, display }, { status: "review" });

  assertEquals(calls.length, 2);
  assertEquals(calls[1].a.startsWith("🔍 p1"), true);
  assertEquals((calls[1].c.request as string).endsWith("..."), true);
  assertEquals((calls[1].c.trace as string).endsWith("..."), true);
});

Deno.test("handlePlanShow: prints metadata and content", async () => {
  const { display, calls } = createDisplay();
  const planCommands = {
    show: () =>
      Promise.resolve({
        id: "p1",
        status: "review",
        trace_id: "t",
        content: "C",
        request_id: "r",
        request_title: "title",
        input_tokens: 120,
        output_tokens: 45,
        total_tokens: 165,
        token_provider: "openai-gpt-4",
        token_model: "gpt-4",
        token_cost_usd: 0.0025,
      }),
  };

  await handlePlanShow({ planCommands: planCommands as any, display }, "p1");

  assertEquals(calls.length, 2);
  assertEquals(calls[0].a, "plan.show");
  assertEquals(calls[0].c.input_tokens, 120);
  assertEquals(calls[0].c.output_tokens, 45);
  assertEquals(calls[0].c.total_tokens, 165);
  assertEquals(calls[0].c.token_provider, "openai-gpt-4");
  assertEquals(calls[0].c.token_model, "gpt-4");
  assertEquals(calls[0].c.token_cost_usd, 0.0025);
  assertEquals(calls[1].a, "plan.content");
});

Deno.test("handlePlanApprove: splits skills", async () => {
  const { display } = createDisplay();
  const calls: unknown[] = [];
  const planCommands = {
    approve: (id: string, skills?: string[]) => {
      calls.push({ id, skills });
      return Promise.resolve();
    },
  };

  await handlePlanApprove({ planCommands: planCommands as any, display }, "p1", { skills: "a, b" });
  assertEquals((calls[0] as any).skills, ["a", "b"]);
});

Deno.test("handlePlanReject/Revise: delegates", async () => {
  const { display } = createDisplay();
  const calls: string[] = [];
  const planCommands = {
    reject: () => {
      calls.push("reject");
      return Promise.resolve();
    },
    revise: () => {
      calls.push("revise");
      return Promise.resolve();
    },
  };

  await handlePlanReject({ planCommands: planCommands as any, display }, "p", "r");
  await handlePlanRevise({ planCommands: planCommands as any, display }, "p", ["c"]);

  assertEquals(calls, ["reject", "revise"]);
});
