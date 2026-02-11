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
import { DialogStatus } from "../../../src/enums.ts";
import { createMockDialog, createMockService, createTestContext } from "./memory_test_helpers.ts";

Deno.test("DialogProcessor.processConfirmApproveDialog: cancelled", async () => {
  const { ctx, statuses } = createTestContext();
  const dialog = createMockDialog({ type: DialogStatus.CANCELLED });

  await DialogProcessor.processConfirmApproveDialog(dialog, ctx);

  assertEquals(statuses, [TUI_STATUS_MSG_CANCELLED]);
});

Deno.test("DialogProcessor.processConfirmApproveDialog: success", async () => {
  const calls: string[] = [];
  const service = createMockService({
    approvePending: (id: string) => {
      calls.push(`approve:${id}`);
      return Promise.resolve();
    },
  });

  const { ctx, statuses, counters } = createTestContext({ service });
  const dialog = createMockDialog({ type: DialogStatus.CONFIRMED, value: { proposalId: "p1" } });

  await DialogProcessor.processConfirmApproveDialog(dialog, ctx);

  assertEquals(calls, ["approve:p1"]);
  assertEquals(statuses, [TUI_STATUS_MSG_PROPOSAL_APPROVED]);
  assertEquals(counters.treeReloads, 1);
  assertEquals(counters.pendingReloads, 1);
});

Deno.test("DialogProcessor.processConfirmRejectDialog: success", async () => {
  const calls: string[] = [];
  const service = createMockService({
    rejectPending: (id: string, reason: string) => {
      calls.push(`reject:${id}:${reason}`);
      return Promise.resolve();
    },
  });

  const { ctx, statuses, counters } = createTestContext({ service });
  const dialog = createMockDialog({ type: DialogStatus.CONFIRMED, value: { proposalId: "p1", reason: "r" } });

  await DialogProcessor.processConfirmRejectDialog(dialog, ctx);

  assertEquals(calls, ["reject:p1:r"]);
  assertEquals(statuses, [TUI_STATUS_MSG_PROPOSAL_REJECTED]);
  assertEquals(counters.treeReloads, 1);
  assertEquals(counters.pendingReloads, 1);
});

Deno.test("DialogProcessor.processConfirmRejectDialog: cancelled", async () => {
  const { ctx, statuses } = createTestContext();
  const dialog = createMockDialog({ type: DialogStatus.CANCELLED });

  await DialogProcessor.processConfirmRejectDialog(dialog, ctx);

  assertEquals(statuses, [TUI_STATUS_MSG_CANCELLED]);
});

Deno.test("DialogProcessor.processConfirmRejectDialog: error surfaces non-Error values", async () => {
  const service = createMockService({
    rejectPending: () => Promise.reject("boom"),
  });

  const { ctx, statuses, counters } = createTestContext({ service });
  const dialog = createMockDialog({ type: DialogStatus.CONFIRMED, value: { proposalId: "p1", reason: "r" } });

  await DialogProcessor.processConfirmRejectDialog(dialog, ctx);

  assertEquals(statuses, [`${TUI_STATUS_MSG_ERROR_PREFIX}boom`]);
  assertEquals(counters.treeReloads, 0);
  assertEquals(counters.pendingReloads, 0);
});

Deno.test("DialogProcessor.processBulkApproveDialog: approves each pending and reports progress", async () => {
  const approved: string[] = [];
  const service = createMockService({
    listPending: () => Promise.resolve([{ id: "a" }, { id: "b" }] as any),
    approvePending: (id: string) => {
      approved.push(id);
      return Promise.resolve();
    },
  });

  const { ctx, statuses, counters } = createTestContext({ service });
  const progress: number[] = [];
  const dialog = createMockDialog({ type: DialogStatus.CONFIRMED, value: {} }, {
    setProgress: (n: number) => progress.push(n),
  });

  await DialogProcessor.processBulkApproveDialog(dialog, ctx);

  assertEquals(approved, ["a", "b"]);
  assertEquals(progress, [1, 2]);
  assertEquals(statuses, [TUI_STATUS_MSG_BULK_APPROVE_COMPLETED]);
  assertEquals(counters.treeReloads, 1);
  assertEquals(counters.pendingReloads, 1);
});

Deno.test("DialogProcessor.processBulkApproveDialog: cancelled", async () => {
  const { ctx, statuses } = createTestContext();
  const dialog = createMockDialog({ type: DialogStatus.CANCELLED });

  await DialogProcessor.processBulkApproveDialog(dialog, ctx);

  assertEquals(statuses, [TUI_STATUS_MSG_CANCELLED]);
});

Deno.test("DialogProcessor.processBulkApproveDialog: error surfaces via status", async () => {
  const service = createMockService({
    listPending: () => Promise.reject(new Error("fail")),
  });

  const { ctx, statuses, counters } = createTestContext({ service });
  const dialog = createMockDialog({ type: DialogStatus.CONFIRMED, value: {} }, {
    setProgress: (_n: number) => {},
  });

  await DialogProcessor.processBulkApproveDialog(dialog, ctx);

  assertEquals(statuses, [`${TUI_STATUS_MSG_ERROR_PREFIX}fail`]);
  assertEquals(counters.treeReloads, 0);
  assertEquals(counters.pendingReloads, 0);
});

Deno.test("DialogProcessor.processAddLearningDialog: cancelled", async () => {
  const { ctx, statuses } = createTestContext();
  const dialog = createMockDialog({ type: DialogStatus.CANCELLED });

  await DialogProcessor.processAddLearningDialog(dialog, ctx);

  assertEquals(statuses, [TUI_STATUS_MSG_CANCELLED]);
});

Deno.test("DialogProcessor.processAddLearningDialog: confirmed sets status and reloads tree", async () => {
  const { ctx, statuses, counters } = createTestContext();
  const dialog = createMockDialog({ type: DialogStatus.CONFIRMED, value: {} });

  await DialogProcessor.processAddLearningDialog(dialog, ctx);

  assertEquals(statuses, [TUI_STATUS_MSG_LEARNING_ADDED]);
  assertEquals(counters.treeReloads, 1);
});

Deno.test("DialogProcessor.processAddLearningDialog: error surfaces via status", async () => {
  const { statuses, counters, ctx } = createTestContext();
  const dialog = createMockDialog({ type: DialogStatus.CONFIRMED, value: {} });
  const failingCtx = {
    ...ctx,
    onTreeReload: () => Promise.reject(new Error("reload failed")),
  };

  await DialogProcessor.processAddLearningDialog(dialog, failingCtx);

  assertEquals(statuses, [TUI_STATUS_MSG_LEARNING_ADDED, `${TUI_STATUS_MSG_ERROR_PREFIX}reload failed`]);
  assertEquals(counters.treeReloads, 0);
});

Deno.test("DialogProcessor.processPromoteDialog: cancelled", async () => {
  const { ctx, statuses } = createTestContext();
  const dialog = createMockDialog({ type: DialogStatus.CANCELLED });

  await DialogProcessor.processPromoteDialog(dialog, ctx);

  assertEquals(statuses, [TUI_STATUS_MSG_CANCELLED]);
});

Deno.test("DialogProcessor.processPromoteDialog: confirmed sets status and reloads tree", async () => {
  const { ctx, statuses, counters } = createTestContext();
  const dialog = createMockDialog({ type: DialogStatus.CONFIRMED, value: {} });

  await DialogProcessor.processPromoteDialog(dialog, ctx);

  assertEquals(statuses, [TUI_STATUS_MSG_PROMOTE_COMPLETED]);
  assertEquals(counters.treeReloads, 1);
});

Deno.test("DialogProcessor.processConfirmApproveDialog: error surfaces via status", async () => {
  const service = createMockService({
    approvePending: () => Promise.reject(new Error("fail")),
  });

  const { ctx, statuses, counters } = createTestContext({ service });
  const dialog = createMockDialog({ type: DialogStatus.CONFIRMED, value: { proposalId: "p1" } });

  await DialogProcessor.processConfirmApproveDialog(dialog, ctx);

  assertEquals(statuses, [`${TUI_STATUS_MSG_ERROR_PREFIX}fail`]);
  assertEquals(counters.treeReloads, 0);
  assertEquals(counters.pendingReloads, 0);
});
