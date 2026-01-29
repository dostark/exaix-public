/**
 * Dialog result processor for Memory View
 * Extracted from memory_view.ts to reduce complexity
 */

import type { MemoryServiceInterface } from "../memory_view.ts";
import {
  AddLearningDialog,
  BulkApproveDialog,
  ConfirmApproveDialog,
  ConfirmRejectDialog,
  PromoteDialog,
} from "../dialogs/memory_dialogs.ts";

export interface DialogProcessorContext {
  service: MemoryServiceInterface;
  onStatusUpdate: (message: string) => void;
  onTreeReload: () => Promise<void>;
  onPendingCountReload: () => Promise<void>;
}

/**
 * Process confirm approve dialog result
 */
export async function processConfirmApproveDialog(
  dialog: ConfirmApproveDialog,
  context: DialogProcessorContext,
): Promise<void> {
  const result = dialog.getResult();
  if (result.type === "cancelled") {
    context.onStatusUpdate("Cancelled");
    return;
  }
  try {
    await context.service.approvePending(result.value.proposalId);
    context.onStatusUpdate("Proposal approved");
    await context.onTreeReload();
    await context.onPendingCountReload();
  } catch (e) {
    context.onStatusUpdate(`Error: ${e instanceof Error ? e.message : String(e)}`);
  }
}

/**
 * Process confirm reject dialog result
 */
export async function processConfirmRejectDialog(
  dialog: ConfirmRejectDialog,
  context: DialogProcessorContext,
): Promise<void> {
  const result = dialog.getResult();
  if (result.type === "cancelled") {
    context.onStatusUpdate("Cancelled");
    return;
  }
  try {
    await context.service.rejectPending(result.value.proposalId, result.value.reason);
    context.onStatusUpdate("Proposal rejected");
    await context.onTreeReload();
    await context.onPendingCountReload();
  } catch (e) {
    context.onStatusUpdate(`Error: ${e instanceof Error ? e.message : String(e)}`);
  }
}

/**
 * Process bulk approve dialog result
 */
export async function processBulkApproveDialog(
  dialog: BulkApproveDialog,
  context: DialogProcessorContext,
): Promise<void> {
  const result = dialog.getResult();
  if (result.type === "cancelled") {
    context.onStatusUpdate("Cancelled");
    return;
  }
  try {
    const pending = await context.service.listPending();
    let approved = 0;
    for (const proposal of pending) {
      await context.service.approvePending(proposal.id);
      approved++;
    }
    context.onStatusUpdate(`Approved ${approved} proposals`);
    await context.onTreeReload();
    await context.onPendingCountReload();
  } catch (e) {
    context.onStatusUpdate(`Error: ${e instanceof Error ? e.message : String(e)}`);
  }
}

/**
 * Process add learning dialog result
 */
export function processAddLearningDialog(
  dialog: AddLearningDialog,
  context: DialogProcessorContext,
): void {
  const result = dialog.getResult();
  if (result.type === "cancelled") {
    context.onStatusUpdate("Cancelled");
    return;
  }
  // AddLearning would require additional service method
  context.onStatusUpdate("Learning add not implemented yet");
}

/**
 * Process promote dialog result
 */
export function processPromoteDialog(
  dialog: PromoteDialog,
  context: DialogProcessorContext,
): void {
  const result = dialog.getResult();
  if (result.type === "cancelled") {
    context.onStatusUpdate("Cancelled");
    return;
  }
  // Promote would require additional service method
  context.onStatusUpdate("Promote not implemented yet");
}
