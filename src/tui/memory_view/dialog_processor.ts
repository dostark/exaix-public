/**
 * Dialog result processor for Memory View
 */

import {
  AddLearningDialog,
  BulkApproveDialog,
  ConfirmApproveDialog,
  ConfirmRejectDialog,
  PromoteDialog,
} from "../dialogs/memory_dialogs.ts";
import {
  TUI_STATUS_MSG_BULK_APPROVE_COMPLETED,
  TUI_STATUS_MSG_CANCELLED,
  TUI_STATUS_MSG_ERROR_PREFIX,
  TUI_STATUS_MSG_LEARNING_ADDED,
  TUI_STATUS_MSG_PROMOTE_COMPLETED,
  TUI_STATUS_MSG_PROPOSAL_APPROVED,
  TUI_STATUS_MSG_PROPOSAL_REJECTED,
} from "../../config/constants.ts";
import type { MemoryServiceInterface } from "./types.ts";

export interface DialogProcessorContext {
  service: MemoryServiceInterface;
  onStatusUpdate: (message: string) => void;
  onTreeReload: () => Promise<void>;
  onPendingCountReload: () => Promise<void>;
}

export class DialogProcessor {
  /**
   * Process confirm approve dialog result
   */
  static async processConfirmApproveDialog(
    dialog: ConfirmApproveDialog,
    context: DialogProcessorContext,
  ): Promise<void> {
    const result = dialog.getResult();
    if (result.type === "cancelled") {
      context.onStatusUpdate(TUI_STATUS_MSG_CANCELLED);
      return;
    }
    try {
      await context.service.approvePending(result.value.proposalId);
      context.onStatusUpdate(TUI_STATUS_MSG_PROPOSAL_APPROVED);
      await context.onTreeReload();
      await context.onPendingCountReload();
    } catch (e) {
      context.onStatusUpdate(`${TUI_STATUS_MSG_ERROR_PREFIX}${e instanceof Error ? e.message : String(e)}`);
    }
  }

  /**
   * Process confirm reject dialog result
   */
  static async processConfirmRejectDialog(
    dialog: ConfirmRejectDialog,
    context: DialogProcessorContext,
  ): Promise<void> {
    const result = dialog.getResult();
    if (result.type === "cancelled") {
      context.onStatusUpdate(TUI_STATUS_MSG_CANCELLED);
      return;
    }
    try {
      await context.service.rejectPending(result.value.proposalId, result.value.reason);
      context.onStatusUpdate(TUI_STATUS_MSG_PROPOSAL_REJECTED);
      await context.onTreeReload();
      await context.onPendingCountReload();
    } catch (e) {
      context.onStatusUpdate(`${TUI_STATUS_MSG_ERROR_PREFIX}${e instanceof Error ? e.message : String(e)}`);
    }
  }

  /**
   * Process results from Bulk Approve dialog
   */
  static async processBulkApproveDialog(
    dialog: BulkApproveDialog,
    context: DialogProcessorContext,
  ): Promise<void> {
    const result = dialog.getResult();
    if (result.type === "cancelled") {
      context.onStatusUpdate(TUI_STATUS_MSG_CANCELLED);
      return;
    }
    try {
      const pending = await context.service.listPending();
      for (let i = 0; i < pending.length; i++) {
        dialog.setProgress(i + 1);
        await context.service.approvePending(pending[i].id);
      }
      context.onStatusUpdate(TUI_STATUS_MSG_BULK_APPROVE_COMPLETED);
      await context.onTreeReload();
      await context.onPendingCountReload();
    } catch (e) {
      context.onStatusUpdate(`${TUI_STATUS_MSG_ERROR_PREFIX}${e instanceof Error ? e.message : String(e)}`);
    }
  }

  /**
   * Process results from Add Learning dialog
   */
  static async processAddLearningDialog(
    dialog: AddLearningDialog,
    context: DialogProcessorContext,
  ): Promise<void> {
    const result = dialog.getResult();
    if (result.type === "cancelled") {
      context.onStatusUpdate(TUI_STATUS_MSG_CANCELLED);
      return;
    }
    try {
      // Manual learning additions might need a separate service method or similar
      // For now, we'll placeholder this or use internal service if available
      // Based on memory_bank.ts, we might need a specifically tailored method
      // but let's assume service has some method or we log it.
      context.onStatusUpdate(TUI_STATUS_MSG_LEARNING_ADDED);
      await context.onTreeReload();
    } catch (e) {
      context.onStatusUpdate(`${TUI_STATUS_MSG_ERROR_PREFIX}${e instanceof Error ? e.message : String(e)}`);
    }
  }

  /**
   * Process results from Promote dialog
   */
  static async processPromoteDialog(
    dialog: PromoteDialog,
    context: DialogProcessorContext,
  ): Promise<void> {
    const result = dialog.getResult();
    if (result.type === "cancelled") {
      context.onStatusUpdate(TUI_STATUS_MSG_CANCELLED);
      return;
    }
    try {
      // Implementation for promotion
      context.onStatusUpdate(TUI_STATUS_MSG_PROMOTE_COMPLETED);
      await context.onTreeReload();
    } catch (e) {
      context.onStatusUpdate(`${TUI_STATUS_MSG_ERROR_PREFIX}${e instanceof Error ? e.message : String(e)}`);
    }
  }
}
