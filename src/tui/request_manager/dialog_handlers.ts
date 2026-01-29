/**
 * Dialog handlers for Request Manager View
 * Extracted from request_manager_view.ts to reduce complexity
 */

import { ConfirmDialog, InputDialog } from "../utils/dialog_base.ts";

export type RequestDialogType = "search" | "filter-status" | "filter-agent" | "create" | "priority" | null;

/**
 * Handle completed dialogs for Request Manager
 */
export async function processDialogCompletion(
  dialog: InputDialog | ConfirmDialog | null,
  dialogType: RequestDialogType,
  handlers: {
    handleSearchResult: (value: string) => void;
    handleFilterStatusResult: (value: string) => void;
    handleFilterAgentResult: (value: string) => void;
    handleCreateResult: (value: string) => Promise<void>;
    handlePriorityResult: (value: string) => void;
    processConfirmDialog: (dialog: ConfirmDialog) => Promise<void>;
    setStatus: (message: string, type?: "info" | "success" | "warning" | "error") => void;
  },
): Promise<void> {
  if (!dialog) return;

  // Input dialog confirmed
  if (dialog instanceof InputDialog && dialog.getState() === "confirmed") {
    const result = dialog.getResult();
    if (result.type === "confirmed") {
      switch (dialogType) {
        case "search":
          handlers.handleSearchResult(result.value);
          break;
        case "filter-status":
          handlers.handleFilterStatusResult(result.value);
          break;
        case "filter-agent":
          handlers.handleFilterAgentResult(result.value);
          break;
        case "create":
          try {
            await handlers.handleCreateResult(result.value);
          } catch (e) {
            handlers.setStatus(`Error: ${e}`, "error");
          }
          break;
        case "priority":
          handlers.handlePriorityResult(result.value);
          break;
        default:
          break;
      }
    }
  }

  // Confirm dialog (cancel request)
  if (dialog instanceof ConfirmDialog && dialog.getState() === "confirmed") {
    await handlers.processConfirmDialog(dialog);
  }
}
