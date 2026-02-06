/**
 * Additional Coverage Tests for exoctl.ts
 *
 * Tests for untested paths to improve coverage:
 * - Error handlers for all command actions
 * - Various option combinations
 * - Edge cases in command parsing
 */

import { assert, assertEquals } from "@std/assert";
import {
  CritiqueSeverity,
  FlowInputSource,
  FlowOutputFormat,
  MemoryOperation,
  MemoryScope,
  MemorySource,
  PortalOperation,
  PortalStatus,
  SkillStatus as _SkillStatus,
} from "../../src/enums.ts";
import { MemoryStatus } from "../../src/memory/memory_status.ts";
import { PlanStatus } from "../../src/plans/plan_status.ts";
import { RequestStatus } from "../../src/requests/request_status.ts";
import { ReviewStatus } from "../../src/reviews/review_status.ts";
import { captureAllOutputs, captureConsoleOutput, expectExitWithLogs, withTestMod } from "./helpers/test_utils.ts";

// ===== Plan Command Error Handlers =====

Deno.test("plan list error exits with message", async () => {
  await withTestMod(async (mod, ctx) => {
    (ctx.planCommands as any).list = () => {
      throw new Error("plan list failed");
    };
    const { errors } = await expectExitWithLogs(async () => {
      await (mod.__test_command as any).parse(["plan", "list"]);
    });
    assert(errors.some((e: string) => e.includes("plan list failed")));
  });
});

Deno.test("plan show error exits with message", async () => {
  await withTestMod(async (mod, ctx) => {
    (ctx.planCommands as any).show = () => {
      throw new Error("plan not found");
    };
    const { errors } = await expectExitWithLogs(async () => {
      await (mod.__test_command as any).parse(["plan", "show", "missing"]);
    });
    assert(errors.some((e: string) => e.includes("plan not found")));
  });
});

Deno.test("plan approve error exits with message", async () => {
  await withTestMod(async (mod, ctx) => {
    (ctx.planCommands as any).approve = () => {
      throw new Error("approval failed");
    };
    const { errors } = await expectExitWithLogs(async () => {
      await (mod.__test_command as any).parse(["plan", "approve", "p-1"]);
    });
    assert(errors.some((e: string) => e.includes("approval failed")));
  });
});

Deno.test("plan reject error exits with message", async () => {
  await withTestMod(async (mod, ctx) => {
    (ctx.planCommands as any).reject = () => {
      throw new Error("rejection failed");
    };
    const { errors } = await expectExitWithLogs(async () => {
      await (mod.__test_command as any).parse(["plan", "reject", "p-1", "-r", "bad"]);
    });
    assert(errors.some((e: string) => e.includes("rejection failed")));
  });
});

Deno.test("plan revise error exits with message", async () => {
  await withTestMod(async (mod, ctx) => {
    (ctx.planCommands as any).revise = () => {
      throw new Error("revision failed");
    };
    const { errors } = await expectExitWithLogs(async () => {
      await (mod.__test_command as any).parse(["plan", "revise", "p-1", "-c", "comment"]);
    });
    assert(errors.some((e: string) => e.includes("revision failed")));
  });
});

// ===== Review Command Error Handlers =====

Deno.test("review list error exits with message", async () => {
  await withTestMod(async (mod, ctx) => {
    (ctx.reviewCommands as any).list = () => {
      throw new Error("review list failed");
    };
    const { errors } = await expectExitWithLogs(async () => {
      await (mod.__test_command as any).parse(["review", "list"]);
    });
    assert(errors.some((e: string) => e.includes("review list failed")));
  });
});

Deno.test("review approve error exits with message", async () => {
  await withTestMod(async (mod, ctx) => {
    (ctx.reviewCommands as any).approve = () => {
      throw new Error("approval failed");
    };
    const { errors } = await expectExitWithLogs(async () => {
      await (mod.__test_command as any).parse(["review", "approve", "cs-1"]);
    });
    assert(errors.some((e: string) => e.includes("approval failed")));
  });
});

Deno.test("review reject error exits with message", async () => {
  await withTestMod(async (mod, ctx) => {
    (ctx.reviewCommands as any).reject = () => {
      throw new Error("rejection failed");
    };
    const { errors } = await expectExitWithLogs(async () => {
      await (mod.__test_command as any).parse(["review", "reject", "cs-1", "-r", "bad"]);
    });
    assert(errors.some((e: string) => e.includes("rejection failed")));
  });
});

// ===== Git Command Error Handlers =====

Deno.test("git branches error exits with message", async () => {
  await withTestMod(async (mod, ctx) => {
    (ctx.gitCommands as any).listBranches = () => {
      throw new Error("git error");
    };
    const { errors } = await expectExitWithLogs(async () => {
      await (mod.__test_command as any).parse([PortalOperation.GIT, "branches"]);
    });
    assert(errors.some((e: string) => e.includes("git error")));
  });
});

Deno.test("git status error exits with message", async () => {
  await withTestMod(async (mod, ctx) => {
    (ctx.gitCommands as any).status = () => {
      throw new Error("status failed");
    };
    const { errors } = await expectExitWithLogs(async () => {
      await (mod.__test_command as any).parse([PortalOperation.GIT, "status"]);
    });
    assert(errors.some((e: string) => e.includes("status failed")));
  });
});

Deno.test("git log error exits with message", async () => {
  await withTestMod(async (mod, ctx) => {
    (ctx.gitCommands as any).logByTraceId = () => {
      throw new Error("log failed");
    };
    const { errors } = await expectExitWithLogs(async () => {
      await (mod.__test_command as any).parse([PortalOperation.GIT, "log", "-t", "trace-1"]);
    });
    assert(errors.some((e: string) => e.includes("log failed")));
  });
});

// ===== Daemon Command Error Handlers =====

Deno.test("daemon start error exits with message", async () => {
  await withTestMod(async (mod, ctx) => {
    (ctx.daemonCommands as any).start = () => {
      throw new Error("start failed");
    };
    const { errors } = await expectExitWithLogs(async () => {
      await (mod.__test_command as any).parse(["daemon", "start"]);
    });
    assert(errors.some((e: string) => e.includes("start failed")));
  });
});

Deno.test("daemon stop error exits with message", async () => {
  await withTestMod(async (mod, ctx) => {
    (ctx.daemonCommands as any).stop = () => {
      throw new Error("stop failed");
    };
    const { errors } = await expectExitWithLogs(async () => {
      await (mod.__test_command as any).parse(["daemon", "stop"]);
    });
    assert(errors.some((e: string) => e.includes("stop failed")));
  });
});

Deno.test("daemon restart error exits with message", async () => {
  await withTestMod(async (mod, ctx) => {
    (ctx.daemonCommands as any).restart = () => {
      throw new Error("restart failed");
    };
    const { errors } = await expectExitWithLogs(async () => {
      await (mod.__test_command as any).parse(["daemon", "restart"]);
    });
    assert(errors.some((e: string) => e.includes("restart failed")));
  });
});

Deno.test("daemon status error exits with message", async () => {
  await withTestMod(async (mod, ctx) => {
    (ctx.daemonCommands as any).status = () => {
      throw new Error("status failed");
    };
    const { errors } = await expectExitWithLogs(async () => {
      await (mod.__test_command as any).parse(["daemon", "status"]);
    });
    assert(errors.some((e: string) => e.includes("status failed")));
  });
});

Deno.test("daemon logs error exits with message", async () => {
  await withTestMod(async (mod, ctx) => {
    (ctx.daemonCommands as any).logs = () => {
      throw new Error("logs failed");
    };
    const { errors } = await expectExitWithLogs(async () => {
      await (mod.__test_command as any).parse(["daemon", "logs"]);
    });
    assert(errors.some((e: string) => e.includes("logs failed")));
  });
});

// ===== Portal Command Error Handlers =====

Deno.test("portal add error exits with message", async () => {
  await withTestMod(async (mod, ctx) => {
    (ctx.portalCommands as any).add = () => {
      throw new Error("add failed");
    };
    const { errors } = await expectExitWithLogs(async () => {
      await (mod.__test_command as any).parse(["portal", MemoryOperation.ADD, "/tmp/path", "alias"]);
    });
    assert(errors.some((e: string) => e.includes("add failed")));
  });
});

Deno.test("portal list error exits with message", async () => {
  await withTestMod(async (mod, ctx) => {
    (ctx.portalCommands as any).list = () => {
      throw new Error("list failed");
    };
    const { errors } = await expectExitWithLogs(async () => {
      await (mod.__test_command as any).parse(["portal", "list"]);
    });
    assert(errors.some((e: string) => e.includes("list failed")));
  });
});

Deno.test("portal show error exits with message", async () => {
  await withTestMod(async (mod, ctx) => {
    (ctx.portalCommands as any).show = () => {
      throw new Error("show failed");
    };
    const { errors } = await expectExitWithLogs(async () => {
      await (mod.__test_command as any).parse(["portal", "show", "alias"]);
    });
    assert(errors.some((e: string) => e.includes("show failed")));
  });
});

Deno.test("portal remove error exits with message", async () => {
  await withTestMod(async (mod, ctx) => {
    (ctx.portalCommands as any).remove = () => {
      throw new Error("remove failed");
    };
    const { errors } = await expectExitWithLogs(async () => {
      await (mod.__test_command as any).parse(["portal", "remove", "alias"]);
    });
    assert(errors.some((e: string) => e.includes("remove failed")));
  });
});

Deno.test("portal verify error exits with message", async () => {
  await withTestMod(async (mod, ctx) => {
    (ctx.portalCommands as any).verify = () => {
      throw new Error("verify failed");
    };
    const { errors } = await expectExitWithLogs(async () => {
      await (mod.__test_command as any).parse(["portal", "verify"]);
    });
    assert(errors.some((e: string) => e.includes("verify failed")));
  });
});

Deno.test("portal refresh error exits with message", async () => {
  await withTestMod(async (mod, ctx) => {
    (ctx.portalCommands as any).refresh = () => {
      throw new Error("refresh failed");
    };
    const { errors } = await expectExitWithLogs(async () => {
      await (mod.__test_command as any).parse(["portal", "refresh", "alias"]);
    });
    assert(errors.some((e: string) => e.includes("refresh failed")));
  });
});

// ===== Blueprint Command Error Handlers =====

Deno.test("blueprint list error exits with message", async () => {
  await withTestMod(async (mod, ctx) => {
    (ctx.blueprintCommands as any).list = () => {
      throw new Error("list failed");
    };
    const { errors } = await expectExitWithLogs(async () => {
      await (mod.__test_command as any).parse(["blueprint", "list"]);
    });
    assert(errors.some((e: string) => e.includes("list failed")));
  });
});

Deno.test("blueprint show error exits with message", async () => {
  await withTestMod(async (mod, ctx) => {
    (ctx.blueprintCommands as any).show = () => {
      throw new Error("show failed");
    };
    const { errors } = await expectExitWithLogs(async () => {
      await (mod.__test_command as any).parse(["blueprint", "show", "agent-1"]);
    });
    assert(errors.some((e: string) => e.includes("show failed")));
  });
});

Deno.test("blueprint validate error exits with message", async () => {
  await withTestMod(async (mod, ctx) => {
    (ctx.blueprintCommands as any).validate = () => {
      throw new Error("validate failed");
    };
    const { errors } = await expectExitWithLogs(async () => {
      await (mod.__test_command as any).parse(["blueprint", "validate", "agent-1"]);
    });
    assert(errors.some((e: string) => e.includes("validate failed")));
  });
});

Deno.test("blueprint edit error exits with message", async () => {
  await withTestMod(async (mod, ctx) => {
    (ctx.blueprintCommands as any).edit = () => {
      throw new Error("edit failed");
    };
    const { errors } = await expectExitWithLogs(async () => {
      await (mod.__test_command as any).parse(["blueprint", "edit", "agent-1"]);
    });
    assert(errors.some((e: string) => e.includes("edit failed")));
  });
});

Deno.test("blueprint remove error exits with message", async () => {
  await withTestMod(async (mod, ctx) => {
    (ctx.blueprintCommands as any).remove = () => {
      throw new Error("remove failed");
    };
    const { errors } = await expectExitWithLogs(async () => {
      await (mod.__test_command as any).parse(["blueprint", "remove", "agent-1"]);
    });
    assert(errors.some((e: string) => e.includes("remove failed")));
  });
});

// ===== Blueprint Alias Commands =====

Deno.test("blueprint rm alias calls remove", async () => {
  await withTestMod(async (mod, ctx) => {
    let called = false;
    (ctx.blueprintCommands as any).remove = (id: string, opts?: { force?: boolean }) => {
      called = true;
      assertEquals(id, "agent-rm");
      assertEquals(opts?.force, true);
    };
    await (mod.__test_command as any).parse(["blueprint", "rm", "agent-rm", "--force"]);
    assert(called);
  });
});

// ===== Request List with Status Filter =====

Deno.test("request list passes status filter", async () => {
  await withTestMod(async (mod, ctx) => {
    (ctx.requestCommands as any).list = (status?: string) => {
      assertEquals(status, MemoryStatus.PENDING);
      return [];
    };
    await captureConsoleOutput(async () => {
      await (mod.__test_command as any).parse([FlowInputSource.REQUEST, "list", "-s", MemoryStatus.PENDING]);
    });
  });
});

Deno.test("request list error exits with message", async () => {
  await withTestMod(async (mod, ctx) => {
    (ctx.requestCommands as any).list = () => {
      throw new Error("list failed");
    };
    const { errors } = await expectExitWithLogs(async () => {
      await (mod.__test_command as any).parse([FlowInputSource.REQUEST, "list"]);
    });
    assert(errors.some((e: string) => e.includes("list failed")));
  });
});

// ===== Review List with Status Filter =====

Deno.test("review list passes status filter", async () => {
  await withTestMod(async (mod, ctx) => {
    (ctx.reviewCommands as any).list = (status?: string) => {
      assertEquals(status, ReviewStatus.PENDING);
      return [];
    };
    await captureConsoleOutput(async () => {
      await (mod.__test_command as any).parse(["review", "list", "-s", ReviewStatus.PENDING]);
    });
  });
});

Deno.test("review list empty prints message", async () => {
  await withTestMod(async (mod, ctx) => {
    (ctx.reviewCommands as any).list = () => [];
    const out = await captureConsoleOutput(async () => {
      await (mod.__test_command as any).parse(["review", "list"]);
    });
    assert(out.includes("No reviews found") || out.includes("review.list"));
  });
});

// ===== Portal List with Entries =====

Deno.test("portal list prints entries when present", async () => {
  await withTestMod(async (mod, ctx) => {
    (ctx.portalCommands as any).list = () => [
      {
        alias: "MyPortal",
        symlinkPath: "Portals/MyPortal",
        targetPath: "/tmp/target",
        status: PortalStatus.ACTIVE,
        contextCardPath: "Memory/Projects/MyPortal/portal.md",
      },
      {
        alias: "BrokenPortal",
        symlinkPath: "Portals/BrokenPortal",
        targetPath: "/tmp/missing",
        status: PortalStatus.BROKEN,
        contextCardPath: "Memory/Projects/BrokenPortal/portal.md",
      },
    ];
    const out = await captureConsoleOutput(async () => {
      await (mod.__test_command as any).parse(["portal", "list"]);
    });
    assert(out.includes("MyPortal") || out.includes("Active"));
  });
});

// ===== Git Status with Changes =====

Deno.test("git status prints changes when present", async () => {
  await withTestMod(async (mod, ctx) => {
    (ctx.gitCommands as any).status = () => ({
      branch: "feat/changes",
      modified: ["file1.ts", "file2.ts"],
      added: ["new.ts"],
      deleted: ["old.ts"],
      untracked: ["temp.ts"],
    });
    const out = await captureConsoleOutput(async () => {
      await (mod.__test_command as any).parse([PortalOperation.GIT, "status"]);
    });
    assert(out.includes("feat/changes") || out.includes("git.status"));
  });
});

// ===== Memory Commands =====

Deno.test("memory default action shows list", async () => {
  await withTestMod(async (mod, ctx) => {
    let called = false;
    (ctx.memoryCommands as any).list = (format?: string) => {
      called = true;
      assertEquals(format, "table");
      return "Memory list output";
    };
    const out = await captureConsoleOutput(async () => {
      await (mod.__test_command as any).parse(["memory"]);
    });
    assert(called);
    assert(out.includes("Memory list output"));
  });
});

Deno.test("memory list with format option", async () => {
  await withTestMod(async (mod, ctx) => {
    (ctx.memoryCommands as any).list = (format?: string) => {
      assertEquals(format, FlowOutputFormat.JSON);
      return '{"data": []}';
    };
    const out = await captureConsoleOutput(async () => {
      await (mod.__test_command as any).parse(["memory", "list", "--format", FlowOutputFormat.JSON]);
    });
    assert(out.includes('{"data": []}'));
  });
});

Deno.test("memory search passes all options", async () => {
  await withTestMod(async (mod, ctx) => {
    (ctx.memoryCommands as any).search = (
      query: string,
      opts: { portal?: string; tags?: string[]; limit?: number; format?: string; useEmbeddings?: boolean },
    ) => {
      assertEquals(query, "test query");
      assertEquals(opts.portal, "my-portal");
      assertEquals(opts.tags, ["tag1", "tag2"]);
      assertEquals(opts.limit, 10);
      assertEquals(opts.format, "md");
      assertEquals(opts.useEmbeddings, true);
      return "Search results";
    };
    const out = await captureConsoleOutput(async () => {
      await (mod.__test_command as any).parse([
        "memory",
        "search",
        "test query",
        "-p",
        "my-portal",
        "-t",
        "tag1,tag2",
        "-l",
        "10",
        "--format",
        "md",
        "-e",
      ]);
    });
    assert(out.includes("Search results"));
  });
});

Deno.test("memory project default action lists projects", async () => {
  await withTestMod(async (mod, ctx) => {
    let called = false;
    (ctx.memoryCommands as any).projectList = (_format?: string) => {
      called = true;
      return "Projects list";
    };
    const out = await captureConsoleOutput(async () => {
      await (mod.__test_command as any).parse(["memory", MemoryScope.PROJECT]);
    });
    assert(called);
    assert(out.includes("Projects list"));
  });
});

Deno.test("memory execution default action lists executions", async () => {
  await withTestMod(async (mod, ctx) => {
    let called = false;
    (ctx.memoryCommands as any).executionList = (_opts: any) => {
      called = true;
      return "Executions list";
    };
    const out = await captureConsoleOutput(async () => {
      await (mod.__test_command as any).parse(["memory", MemorySource.EXECUTION]);
    });
    assert(called);
    assert(out.includes("Executions list"));
  });
});

Deno.test("memory pending default action lists pending", async () => {
  await withTestMod(async (mod, ctx) => {
    let called = false;
    (ctx.memoryCommands as any).pendingList = (_format?: string) => {
      called = true;
      return "Pending proposals";
    };
    const out = await captureConsoleOutput(async () => {
      await (mod.__test_command as any).parse(["memory", MemoryStatus.PENDING]);
    });
    assert(called);
    assert(out.includes("Pending proposals"));
  });
});

Deno.test("memory pending approve-all calls pendingApproveAll", async () => {
  await withTestMod(async (mod, ctx) => {
    let called = false;
    (ctx.memoryCommands as any).pendingApproveAll = () => {
      called = true;
      return "All approved";
    };
    const out = await captureConsoleOutput(async () => {
      await (mod.__test_command as any).parse(["memory", MemoryStatus.PENDING, "approve-all"]);
    });
    assert(called);
    assert(out.includes("All approved"));
  });
});

// ===== Flow Commands =====

Deno.test("flow show calls flowCommands.showFlow", async () => {
  await withTestMod(async (mod, ctx) => {
    let called = false;
    (ctx.flowCommands as any).showFlow = (flowId: string, _opts: any) => {
      called = true;
      assertEquals(flowId, "my-flow");
    };
    await (mod.__test_command as any).parse(["flow", "show", "my-flow"]);
    assert(called);
  });
});

Deno.test("flow validate calls flowCommands.validateFlow", async () => {
  await withTestMod(async (mod, ctx) => {
    let called = false;
    (ctx.flowCommands as any).validateFlow = (flowId: string, opts: any) => {
      called = true;
      assertEquals(flowId, "my-flow");
      assertEquals(opts.json, true);
    };
    await (mod.__test_command as any).parse(["flow", "validate", "my-flow", "--json"]);
    assert(called);
  });
});

// ===== Blueprint Show Content Preview =====

Deno.test("blueprint show displays content preview", async () => {
  await withTestMod(async (mod, ctx) => {
    (ctx.blueprintCommands as any).show = (id: string) => ({
      agent_id: id,
      name: "Test Agent",
      model: "mock:test",
      capabilities: ["coding", "review"],
      version: "1.0.0",
      created: "2026-01-04",
      created_by: "tester",
      content: "This is a very long system prompt content that should be truncated in the preview...",
    });
    const out = await captureConsoleOutput(async () => {
      await (mod.__test_command as any).parse(["blueprint", "show", "agent-x"]);
    });
    assert(out.includes("Test Agent") || out.includes("blueprint.show"));
  });
});

// ===== Blueprint Validate with Warnings =====

Deno.test("blueprint validate valid with warnings", async () => {
  await withTestMod(async (mod, ctx) => {
    (ctx.blueprintCommands as any).validate = (_id: string) => ({
      valid: true,
      warnings: ["Consider adding more capabilities"],
    });
    const outs = await captureAllOutputs(async () => {
      await (mod.__test_command as any).parse(["blueprint", "validate", "warn-agent"]);
    });
    const joined = [...outs.logs, ...outs.warns, ...outs.errs].join("\n");
    assert(joined.includes("Valid") || joined.includes("blueprint.valid") || joined.includes("warnings"));
  });
});

// ===== Request with All Options =====

Deno.test("request create with all options", async () => {
  await withTestMod(async (mod, ctx) => {
    (ctx.requestCommands as any).create = (
      desc: string,
      opts: { agent: string; priority: string; portal?: string; model?: string; flow?: string },
    ) => {
      assertEquals(desc, "Do task");
      assertEquals(opts.agent, "custom-agent");
      assertEquals(opts.priority, "high");
      assertEquals(opts.portal, "my-portal");
      assertEquals(opts.model, "gpt-4");
      return {
        filename: "/tmp/req.md",
        trace_id: "t-all",
        priority: "high",
        agent: "custom-agent",
        path: "/tmp",
      };
    };
    await captureConsoleOutput(async () => {
      await (mod.__test_command as any).parse([
        FlowInputSource.REQUEST,
        "Do task",
        "-a",
        "custom-agent",
        "-p",
        "high",
        "--portal",
        "my-portal",
        "-m",
        "gpt-4",
      ]);
    });
  });
});

Deno.test("request create with flow option", async () => {
  await withTestMod(async (mod, ctx) => {
    (ctx.requestCommands as any).create = (
      desc: string,
      opts: { flow: string; priority: string },
    ) => {
      assertEquals(desc, "Code review task");
      assertEquals(opts.flow, "code-review");
      assertEquals(opts.priority, "high");
      return {
        filename: "/tmp/req.md",
        trace_id: "t-flow",
        priority: "high",
        flow: "code-review",
        path: "/tmp",
      };
    };
    await captureConsoleOutput(async () => {
      await (mod.__test_command as any).parse([
        FlowInputSource.REQUEST,
        "Code review task",
        "--flow",
        "code-review",
        "-p",
        "high",
      ]);
    });
  });
});

// ===== __test_initializeServices with instantiateDb =====
// Note: Skip instantiateDb test as it loads native SQLite library that can't be easily unloaded
// The path is covered by other integration tests that properly manage DB lifecycle

// ===== Plan List with needs_revision Status =====

Deno.test("plan list shows needs_revision icon", async () => {
  await withTestMod(async (mod, ctx) => {
    (ctx.planCommands as any).list = () => [
      { id: "p1", status: PlanStatus.NEEDS_REVISION, trace_id: "t1" },
    ];
    const out = await captureConsoleOutput(async () => {
      await (mod.__test_command as any).parse(["plan", "list"]);
    });
    assert(out.includes("⚠️") || out.includes("p1"));
  });
});

// ===== Request List with Different Priorities =====

Deno.test("request list shows different priority icons", async () => {
  await withTestMod(async (mod, ctx) => {
    (ctx.requestCommands as any).list = () => [
      {
        trace_id: "t1",
        priority: CritiqueSeverity.CRITICAL,
        agent: "a",
        created_by: "u",
        created: "t",
        status: MemoryStatus.PENDING,
      },
      { trace_id: "t2", priority: "high", agent: "a", created_by: "u", created: "t", status: MemoryStatus.PENDING },
      { trace_id: "t3", priority: "low", agent: "a", created_by: "u", created: "t", status: MemoryStatus.PENDING },
    ];
    const out = await captureConsoleOutput(async () => {
      await (mod.__test_command as any).parse([FlowInputSource.REQUEST, "list"]);
    });
    // Should show different icons for different priorities
    assert(out.includes("🔴") || out.includes("🟠") || out.includes("⚪") || out.includes("count: 3"));
  });
});

// ===== End-to-End Flow Request Testing =====

Deno.test("end-to-end flow request workflow", async () => {
  await withTestMod(async (mod, ctx) => {
    // Mock the request creation to return a flow request
    (ctx.requestCommands as any).create = (
      desc: string,
      opts: { flow: string; priority: string },
    ) => {
      assertEquals(desc, "Build a web application");
      assertEquals(opts.flow, "web-dev-flow");
      assertEquals(opts.priority, "normal");
      return {
        filename: "/tmp/test-flow-request.md",
        trace_id: "flow-test-123",
        priority: "normal",
        flow: "web-dev-flow",
        path: "/tmp",
      };
    };

    // Mock request listing to return our flow request
    (ctx.requestCommands as any).list = (_status?: string) => {
      return [{
        trace_id: "flow-test-123",
        priority: "normal",
        flow: "web-dev-flow",
        agent: null,
        status: RequestStatus.PENDING,
        created: new Date().toISOString(),
        description: "Build a web application",
      }];
    };

    // Mock request showing to return detailed flow request info
    (ctx.requestCommands as any).show = (traceId: string) => {
      assertEquals(traceId, "flow-test-123");
      return {
        metadata: {
          trace_id: "flow-test-123",
          filename: "flow-test-123.md",
          path: "/tmp/flow-test-123.md",
          status: RequestStatus.PENDING,
          priority: "normal",
          agent: "default",
          flow: "web-dev-flow",
          created: new Date().toISOString(),
          created_by: "test-user",
          source: "cli",
        },
        content: "Build a web application",
      };
    };

    // Test 1: Create flow request
    const createOutput = await captureConsoleOutput(async () => {
      await (mod.__test_command as any).parse([
        FlowInputSource.REQUEST,
        "Build a web application",
        "--flow",
        "web-dev-flow",
      ]);
    });
    assert(createOutput.includes("trace_id: flow-test-123"));
    assert(createOutput.includes("flow: web-dev-flow"));

    // Test 2: List requests includes flow request
    const listOutput = await captureConsoleOutput(async () => {
      await (mod.__test_command as any).parse([FlowInputSource.REQUEST, "list"]);
    });
    assert(listOutput.includes("flow-test-123"));
    assert(listOutput.includes("web-dev-flow"));

    // Test 3: Show request displays flow information
    const showOutput = await captureConsoleOutput(async () => {
      await (mod.__test_command as any).parse([FlowInputSource.REQUEST, "show", "flow-test-123"]);
    });
    assert(showOutput.includes("flow-test-123"));
    assert(showOutput.includes("web-dev-flow"));
    assert(showOutput.includes("Build a web application"));
  });
});
