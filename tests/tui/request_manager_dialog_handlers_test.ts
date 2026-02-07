import { assertEquals } from "@std/assert";
import { ConfirmDialog, InputDialog } from "../../src/helpers/dialog_base.ts";
import { KEYS } from "../../src/helpers/keyboard.ts";
import { RequestDialogType } from "../../src/enums.ts";
import { processDialogCompletion } from "../../src/tui/request_manager/dialog_handlers.ts";

function confirmInputDialog(dialog: InputDialog): void {
  // Default focus is "input" (index 0). Move to confirm (index 1) and confirm.
  dialog.handleKey(KEYS.TAB);
  dialog.handleKey(KEYS.ENTER);
}

Deno.test("processDialogCompletion: routes confirmed InputDialog results by dialogType", async () => {
  const calls: string[] = [];

  const handlers = {
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
    setStatus: (message: string) => {
      calls.push(`status:${message}`);
    },
  };

  const dialog = new InputDialog({
    title: "Search",
    label: "Query",
    defaultValue: "q",
  });
  confirmInputDialog(dialog);

  await processDialogCompletion(dialog, RequestDialogType.SEARCH, handlers);
  assertEquals(calls, ["search:q"]);
});

Deno.test("processDialogCompletion: CREATE errors are surfaced via setStatus", async () => {
  const calls: string[] = [];

  const handlers = {
    handleSearchResult: (_value: string) => {},
    handleFilterStatusResult: (_value: string) => {},
    handleFilterAgentResult: (_value: string) => {},
    handleCreateResult: (_value: string) => Promise.reject(new Error("create failed")),
    handlePriorityResult: (_value: string) => {},
    processConfirmDialog: (_dialog: ConfirmDialog) => Promise.resolve(),
    setStatus: (message: string, type?: "info" | "success" | "warning" | "error") => {
      calls.push(`${type ?? "info"}:${message}`);
    },
  };

  const dialog = new InputDialog({
    title: "Create",
    label: "Description",
    defaultValue: "new request",
  });
  confirmInputDialog(dialog);

  await processDialogCompletion(dialog, RequestDialogType.CREATE, handlers);

  assertEquals(calls.length, 1);
  assertEquals(calls[0].startsWith("error:Error:"), true);
});

Deno.test("processDialogCompletion: confirmed ConfirmDialog is routed to processConfirmDialog", async () => {
  const calls: string[] = [];

  const handlers = {
    handleSearchResult: (_value: string) => {},
    handleFilterStatusResult: (_value: string) => {},
    handleFilterAgentResult: (_value: string) => {},
    handleCreateResult: (_value: string) => Promise.resolve(),
    handlePriorityResult: (_value: string) => {},
    processConfirmDialog: (_dialog: ConfirmDialog) => {
      calls.push("confirm");
      return Promise.resolve();
    },
    setStatus: (_message: string) => {},
  };

  const dialog = new ConfirmDialog({
    title: "Confirm",
    message: "Are you sure?",
  });

  dialog.handleKey(KEYS.Y);

  await processDialogCompletion(dialog, null, handlers);
  assertEquals(calls, ["confirm"]);
});

Deno.test("processDialogCompletion: no-op on null dialog", async () => {
  let called = 0;

  const handlers = {
    handleSearchResult: (_value: string) => {
      called++;
    },
    handleFilterStatusResult: (_value: string) => {
      called++;
    },
    handleFilterAgentResult: (_value: string) => {
      called++;
    },
    handleCreateResult: (_value: string) => {
      called++;
      return Promise.resolve();
    },
    handlePriorityResult: (_value: string) => {
      called++;
    },
    processConfirmDialog: (_dialog: ConfirmDialog) => {
      called++;
      return Promise.resolve();
    },
    setStatus: (_message: string) => {
      called++;
    },
  };

  await processDialogCompletion(null, RequestDialogType.SEARCH, handlers);
  assertEquals(called, 0);
});
