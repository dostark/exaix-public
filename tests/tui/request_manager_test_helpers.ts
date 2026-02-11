import { ConfirmDialog, InputDialog } from "../../src/helpers/dialog_base.ts";
import { KEYS } from "../../src/helpers/keyboard.ts";

export interface MockHandlers {
  handleSearchResult: (value: string) => void;
  handleFilterStatusResult: (value: string) => void;
  handleFilterAgentResult: (value: string) => void;
  handleCreateResult: (value: string) => Promise<void>;
  handlePriorityResult: (value: string) => void;
  processConfirmDialog: (dialog: ConfirmDialog) => Promise<void>;
  setStatus: (message: string, type?: "info" | "success" | "warning" | "error") => void;
}

export function createMockHandlers(
  calls: string[],
  overrides: Partial<MockHandlers> = {},
): MockHandlers {
  return {
    handleSearchResult: (value: string) => {
      calls.push(`search:${value}`);
    },
    handleFilterStatusResult: (value: string) => {
      calls.push(`filter_status:${value}`);
    },
    handleFilterAgentResult: (value: string) => {
      calls.push(`filter_agent:${value}`);
    },
    handleCreateResult: (value: string) => {
      calls.push(`create:${value}`);
      return Promise.resolve();
    },
    handlePriorityResult: (value: string) => {
      calls.push(`priority:${value}`);
    },
    processConfirmDialog: (_dialog: ConfirmDialog) => {
      calls.push("confirm");
      return Promise.resolve();
    },
    setStatus: (message: string, type?: "info" | "success" | "warning" | "error") => {
      const prefix = type ? `${type}:` : "status:";
      calls.push(`${prefix}${message}`);
    },
    ...overrides,
  };
}

export function confirmInputDialog(dialog: InputDialog): void {
  // Default focus is "input" (index 0). Move to confirm (index 1) and confirm.
  dialog.handleKey(KEYS.TAB);
  dialog.handleKey(KEYS.ENTER);
}
