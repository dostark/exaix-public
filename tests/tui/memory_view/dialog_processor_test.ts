import { assertEquals } from "@std/assert";
import {
  TUI_STATUS_MSG_BULK_APPROVE_COMPLETED,
  TUI_STATUS_MSG_CANCELLED,
  TUI_STATUS_MSG_ERROR_PREFIX,
  TUI_STATUS_MSG_LEARNING_ADDED,
  TUI_STATUS_MSG_PROMOTE_COMPLETED,
  TUI_STATUS_MSG_PROPOSAL_APPROVED,
  TUI_STATUS_MSG_PROPOSAL_REJECTED,
} from "../../../src/helpers/constants.ts";
import { DialogProcessor } from "../../../src/tui/memory_view/dialog_processor.ts";
import type { MemoryServiceInterface } from "../../../src/tui/memory_view/types.ts";

function createContext(overrides?: Partial<{ service: MemoryServiceInterface }>) {
  const statuses: string[] = [];
  let treeReloads = 0;
  let pendingReloads = 0;

  const service: MemoryServiceInterface = overrides?.service ?? ({
    listPending: () => Promise.resolve([]),
    approvePending: () => Promise.resolve(),
    rejectPending: () => Promise.resolve(),
  } as unknown as MemoryServiceInterface);

  return {
    statuses,
    counters: {
      get treeReloads() {
        return treeReloads;
      },
      get pendingReloads() {
        return pendingReloads;
      },
    },
    ctx: {
      service,
      onStatusUpdate: (m: string) => statuses.push(m),
      onTreeReload: () => {
        treeReloads++;
        return Promise.resolve();
      },
      onPendingCountReload: () => {
        pendingReloads++;
        return Promise.resolve();
      },
    },
  };
}

Deno.test("DialogProcessor.processConfirmApproveDialog: cancelled", async () => {
  const { ctx, statuses } = createContext();
  const dialog = { getResult: () => ({ type: "cancelled" }) } as any;

  await DialogProcessor.processConfirmApproveDialog(dialog, ctx);

  assertEquals(statuses, [TUI_STATUS_MSG_CANCELLED]);
});

Deno.test("DialogProcessor.processConfirmApproveDialog: success", async () => {
  const calls: string[] = [];
  const service: MemoryServiceInterface = {
    approvePending: (id: string) => {
      calls.push(`approve:${id}`);
      return Promise.resolve();
    },
    listPending: () => Promise.resolve([]),
    rejectPending: () => Promise.resolve(),
  } as unknown as MemoryServiceInterface;

  const { ctx, statuses, counters } = createContext({ service });
  const dialog = { getResult: () => ({ type: "confirmed", value: { proposalId: "p1" } }) } as any;

  await DialogProcessor.processConfirmApproveDialog(dialog, ctx);

  assertEquals(calls, ["approve:p1"]);
  assertEquals(statuses, [TUI_STATUS_MSG_PROPOSAL_APPROVED]);
  assertEquals(counters.treeReloads, 1);
  assertEquals(counters.pendingReloads, 1);
});

Deno.test("DialogProcessor.processConfirmRejectDialog: success", async () => {
  const calls: string[] = [];
  const service: MemoryServiceInterface = {
    rejectPending: (id: string, reason: string) => {
      calls.push(`reject:${id}:${reason}`);
      return Promise.resolve();
    },
    listPending: () => Promise.resolve([]),
    approvePending: () => Promise.resolve(),
  } as unknown as MemoryServiceInterface;

  const { ctx, statuses, counters } = createContext({ service });
  const dialog = {
    getResult: () => ({ type: "confirmed", value: { proposalId: "p1", reason: "r" } }),
  } as any;

  await DialogProcessor.processConfirmRejectDialog(dialog, ctx);

  assertEquals(calls, ["reject:p1:r"]);
  assertEquals(statuses, [TUI_STATUS_MSG_PROPOSAL_REJECTED]);
  assertEquals(counters.treeReloads, 1);
  assertEquals(counters.pendingReloads, 1);
});

Deno.test("DialogProcessor.processConfirmRejectDialog: cancelled", async () => {
  const { ctx, statuses } = createContext();
  const dialog = { getResult: () => ({ type: "cancelled" }) } as any;

  await DialogProcessor.processConfirmRejectDialog(dialog, ctx);

  assertEquals(statuses, [TUI_STATUS_MSG_CANCELLED]);
});

Deno.test("DialogProcessor.processConfirmRejectDialog: error surfaces non-Error values", async () => {
  const service: MemoryServiceInterface = {
    rejectPending: () => Promise.reject("boom"),
    listPending: () => Promise.resolve([]),
    approvePending: () => Promise.resolve(),
  } as unknown as MemoryServiceInterface;

  const { ctx, statuses, counters } = createContext({ service });
  const dialog = {
    getResult: () => ({ type: "confirmed", value: { proposalId: "p1", reason: "r" } }),
  } as any;

  await DialogProcessor.processConfirmRejectDialog(dialog, ctx);

  assertEquals(statuses, [`${TUI_STATUS_MSG_ERROR_PREFIX}boom`]);
  assertEquals(counters.treeReloads, 0);
  assertEquals(counters.pendingReloads, 0);
});

Deno.test("DialogProcessor.processBulkApproveDialog: approves each pending and reports progress", async () => {
  const approved: string[] = [];
  const service: MemoryServiceInterface = {
    listPending: () => Promise.resolve([{ id: "a" }, { id: "b" }] as any),
    approvePending: (id: string) => {
      approved.push(id);
      return Promise.resolve();
    },
    rejectPending: () => Promise.resolve(),
  } as unknown as MemoryServiceInterface;

  const { ctx, statuses, counters } = createContext({ service });
  const progress: number[] = [];
  const dialog = {
    getResult: () => ({ type: "confirmed", value: {} }),
    setProgress: (n: number) => progress.push(n),
  } as any;

  await DialogProcessor.processBulkApproveDialog(dialog, ctx);

  assertEquals(approved, ["a", "b"]);
  assertEquals(progress, [1, 2]);
  assertEquals(statuses, [TUI_STATUS_MSG_BULK_APPROVE_COMPLETED]);
  assertEquals(counters.treeReloads, 1);
  assertEquals(counters.pendingReloads, 1);
});

Deno.test("DialogProcessor.processBulkApproveDialog: cancelled", async () => {
  const { ctx, statuses } = createContext();
  const dialog = { getResult: () => ({ type: "cancelled" }) } as any;

  await DialogProcessor.processBulkApproveDialog(dialog, ctx);

  assertEquals(statuses, [TUI_STATUS_MSG_CANCELLED]);
});

Deno.test("DialogProcessor.processBulkApproveDialog: error surfaces via status", async () => {
  const service: MemoryServiceInterface = {
    listPending: () => Promise.reject(new Error("fail")),
    approvePending: () => Promise.resolve(),
    rejectPending: () => Promise.resolve(),
  } as unknown as MemoryServiceInterface;

  const { ctx, statuses, counters } = createContext({ service });
  const dialog = {
    getResult: () => ({ type: "confirmed", value: {} }),
    setProgress: (_n: number) => {},
  } as any;

  await DialogProcessor.processBulkApproveDialog(dialog, ctx);

  assertEquals(statuses, [`${TUI_STATUS_MSG_ERROR_PREFIX}fail`]);
  assertEquals(counters.treeReloads, 0);
  assertEquals(counters.pendingReloads, 0);
});

Deno.test("DialogProcessor.processAddLearningDialog: cancelled", async () => {
  const { ctx, statuses } = createContext();
  const dialog = { getResult: () => ({ type: "cancelled" }) } as any;

  await DialogProcessor.processAddLearningDialog(dialog, ctx);

  assertEquals(statuses, [TUI_STATUS_MSG_CANCELLED]);
});

Deno.test("DialogProcessor.processAddLearningDialog: confirmed sets status and reloads tree", async () => {
  const { ctx, statuses, counters } = createContext();
  const dialog = { getResult: () => ({ type: "confirmed", value: {} }) } as any;

  await DialogProcessor.processAddLearningDialog(dialog, ctx);

  assertEquals(statuses, [TUI_STATUS_MSG_LEARNING_ADDED]);
  assertEquals(counters.treeReloads, 1);
});

Deno.test("DialogProcessor.processAddLearningDialog: error surfaces via status", async () => {
  const { statuses, counters, ctx } = createContext();
  const dialog = { getResult: () => ({ type: "confirmed", value: {} }) } as any;
  const failingCtx = {
    ...ctx,
    onTreeReload: () => Promise.reject(new Error("reload failed")),
  };

  await DialogProcessor.processAddLearningDialog(dialog, failingCtx);

  assertEquals(statuses, [TUI_STATUS_MSG_LEARNING_ADDED, `${TUI_STATUS_MSG_ERROR_PREFIX}reload failed`]);
  assertEquals(counters.treeReloads, 0);
});

Deno.test("DialogProcessor.processPromoteDialog: cancelled", async () => {
  const { ctx, statuses } = createContext();
  const dialog = { getResult: () => ({ type: "cancelled" }) } as any;

  await DialogProcessor.processPromoteDialog(dialog, ctx);

  assertEquals(statuses, [TUI_STATUS_MSG_CANCELLED]);
});

Deno.test("DialogProcessor.processPromoteDialog: confirmed sets status and reloads tree", async () => {
  const { ctx, statuses, counters } = createContext();
  const dialog = { getResult: () => ({ type: "confirmed", value: {} }) } as any;

  await DialogProcessor.processPromoteDialog(dialog, ctx);

  assertEquals(statuses, [TUI_STATUS_MSG_PROMOTE_COMPLETED]);
  assertEquals(counters.treeReloads, 1);
});

Deno.test("DialogProcessor.processConfirmApproveDialog: error surfaces via status", async () => {
  const service: MemoryServiceInterface = {
    approvePending: () => Promise.reject(new Error("fail")),
    listPending: () => Promise.resolve([]),
    rejectPending: () => Promise.resolve(),
  } as unknown as MemoryServiceInterface;

  const { ctx, statuses, counters } = createContext({ service });
  const dialog = { getResult: () => ({ type: "confirmed", value: { proposalId: "p1" } }) } as any;

  await DialogProcessor.processConfirmApproveDialog(dialog, ctx);

  assertEquals(statuses, [`${TUI_STATUS_MSG_ERROR_PREFIX}fail`]);
  assertEquals(counters.treeReloads, 0);
  assertEquals(counters.pendingReloads, 0);
});
