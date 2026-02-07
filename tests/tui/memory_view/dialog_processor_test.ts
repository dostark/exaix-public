import { assertEquals } from "@std/assert";
import {
  TUI_STATUS_MSG_BULK_APPROVE_COMPLETED,
  TUI_STATUS_MSG_CANCELLED,
  TUI_STATUS_MSG_ERROR_PREFIX,
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
