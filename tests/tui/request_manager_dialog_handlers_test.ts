import { assertEquals } from "@std/assert";
import { ConfirmDialog, InputDialog } from "../../src/helpers/dialog_base.ts";
import { KEYS } from "../../src/helpers/keyboard.ts";
import { RequestDialogType } from "../../src/enums.ts";
import { processDialogCompletion } from "../../src/tui/request_manager/dialog_handlers.ts";
import { confirmInputDialog, createMockHandlers } from "./request_manager_test_helpers.ts";

Deno.test("processDialogCompletion: routes confirmed InputDialog results by dialogType", async () => {
  const calls: string[] = [];
  const handlers = createMockHandlers(calls);

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
  const handlers = createMockHandlers(calls, {
    handleCreateResult: (_value: string) => Promise.reject(new Error("create failed")),
    setStatus: (message: string, type?: "info" | "success" | "warning" | "error") => {
      calls.push(`${type ?? "info"}:${message}`);
    },
  });

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
  const handlers = createMockHandlers(calls);

  const dialog = new ConfirmDialog({
    title: "Confirm",
    message: "Are you sure?",
  });

  dialog.handleKey(KEYS.Y);

  await processDialogCompletion(dialog, null, handlers);
  assertEquals(calls, ["confirm"]);
});

Deno.test("processDialogCompletion: cancelled InputDialog does not invoke handlers", async () => {
  const calls: string[] = [];
  const handlers = createMockHandlers(calls);

  const dialog = new InputDialog({
    title: "Search",
    label: "Query",
    defaultValue: "q",
  });

  dialog.handleKey(KEYS.ESCAPE);

  await processDialogCompletion(dialog, RequestDialogType.SEARCH, handlers);
  assertEquals(calls.length, 0);
});

Deno.test("processDialogCompletion: confirmed InputDialog routes filter and priority handlers", async () => {
  const calls: string[] = [];
  const handlers = createMockHandlers(calls);

  const filterStatusDialog = new InputDialog({
    title: "Filter Status",
    label: "Status",
    defaultValue: "pending",
  });
  confirmInputDialog(filterStatusDialog);
  await processDialogCompletion(filterStatusDialog, RequestDialogType.FILTER_STATUS, handlers);

  const filterAgentDialog = new InputDialog({
    title: "Filter Agent",
    label: "Agent",
    defaultValue: "default",
  });
  confirmInputDialog(filterAgentDialog);
  await processDialogCompletion(filterAgentDialog, RequestDialogType.FILTER_AGENT, handlers);

  const priorityDialog = new InputDialog({
    title: "Priority",
    label: "Priority",
    defaultValue: "high",
  });
  confirmInputDialog(priorityDialog);
  await processDialogCompletion(priorityDialog, RequestDialogType.PRIORITY, handlers);

  assertEquals(calls, ["filter_status:pending", "filter_agent:default", "priority:high"]);
});

Deno.test("processDialogCompletion: confirmed InputDialog with null dialogType is ignored", async () => {
  const calls: string[] = [];
  const handlers = createMockHandlers(calls);

  const dialog = new InputDialog({
    title: "Unknown",
    label: "Value",
    defaultValue: "noop",
  });
  confirmInputDialog(dialog);

  await processDialogCompletion(dialog, null, handlers);
  assertEquals(calls.length, 0);
});

Deno.test("processDialogCompletion: cancelled ConfirmDialog does not invoke handler", async () => {
  const calls: string[] = [];
  const handlers = createMockHandlers(calls);

  const dialog = new ConfirmDialog({
    title: "Confirm",
    message: "Cancel?",
  });
  dialog.handleKey(KEYS.N);

  await processDialogCompletion(dialog, null, handlers);
  assertEquals(calls.length, 0);
});

Deno.test("processDialogCompletion: no-op on null dialog", async () => {
  const calls: string[] = [];
  const handlers = createMockHandlers(calls);

  await processDialogCompletion(null, RequestDialogType.SEARCH, handlers);
  assertEquals(calls.length, 0);
});
