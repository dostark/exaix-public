/**
 * Memory Dialogs TUI Tests
 *
 * Part of Phase 12.13: TUI Memory View - Pending & Actions
 *
 * Tests cover:
 * - ConfirmApproveDialog rendering and interaction
 * - ConfirmRejectDialog with reason input
 * - AddLearningDialog form validation
 * - PromoteDialog target options
 * - BulkApproveDialog progress display
 * - Keyboard shortcut handling
 */

import { ConfidenceLevel } from "../../src/enums.ts";
import {
  DialogStatus,
  LearningCategory,
  MemoryOperation,
  MemoryScope,
  MemorySource,
  MemoryStatus,
} from "../../src/enums.ts";

import { assertEquals, assertExists } from "@std/assert";
import {
  AddLearningDialog,
  BulkApproveDialog,
  ConfirmApproveDialog,
  ConfirmRejectDialog,
  PromoteDialog,
} from "../../src/tui/dialogs/memory_dialogs.ts";
import type { MemoryUpdateProposal } from "../../src/schemas/memory_bank.ts";
import {
  KEY_A,
  KEY_B,
  KEY_BACKSPACE,
  KEY_C,
  KEY_CAPITAL_N,
  KEY_D,
  KEY_E,
  KEY_ENTER,
  KEY_ESCAPE,
  KEY_N,
  KEY_O,
  KEY_RIGHT,
  KEY_S,
  KEY_T,
  KEY_TAB,
  KEY_Y,
} from "../../src/config/constants.ts";

// ===== Test Fixtures =====

function createMockProposal(): MemoryUpdateProposal {
  return {
    id: "test-proposal-1",
    agent: "test-agent",
    operation: MemoryOperation.ADD,
    learning: {
      id: "learning-1",
      title: "Error Handling Pattern",
      category: LearningCategory.PATTERN,
      description: "All async functions should use try-catch with typed errors.",
      confidence: ConfidenceLevel.HIGH,
      tags: ["error-handling", "typescript"],
      source: MemorySource.AGENT,
      scope: MemoryScope.PROJECT,
      created_at: new Date().toISOString(),
    },
    target_scope: MemoryScope.PROJECT,
    target_project: "my-app",
    reason: "Extracted from execution trace-abc123",
    created_at: new Date().toISOString(),
    status: MemoryStatus.PENDING,
  };
}

// ===== ConfirmApproveDialog Tests =====

Deno.test("ConfirmApproveDialog: renders correctly", () => {
  const proposal = createMockProposal();
  const dialog = new ConfirmApproveDialog(proposal);

  const rendered = dialog.render({ width: 80, height: 20, useColors: true }).join("\n");
  assertExists(rendered);
  assertEquals(rendered.includes("Approve Proposal"), true);
  assertEquals(rendered.includes("Error Handling Pattern"), true);
  assertEquals(rendered.includes(MemoryScope.PROJECT), true);
});

Deno.test("ConfirmApproveDialog: starts active", () => {
  const proposal = createMockProposal();
  const dialog = new ConfirmApproveDialog(proposal);

  assertEquals(dialog.isActive(), true);
  assertEquals(dialog.getState(), DialogStatus.ACTIVE);
});

Deno.test("ConfirmApproveDialog: left/right switches focus", () => {
  const proposal = createMockProposal();
  const dialog = new ConfirmApproveDialog(proposal);

  dialog.handleKey(KEY_RIGHT);
  const rendered1 = dialog.render({ width: 80, height: 20, useColors: true }).join("\n");
  assertEquals(rendered1.includes("[No, Cancel]"), true);

  dialog.handleKey(KEY_RIGHT);
  const rendered2 = dialog.render({ width: 80, height: 20, useColors: true }).join("\n");
  assertEquals(rendered2.includes("[Yes, Approve]"), true);
});

Deno.test("ConfirmApproveDialog: enter on approve confirms", () => {
  const proposal = createMockProposal();
  const dialog = new ConfirmApproveDialog(proposal);

  dialog.handleKey(KEY_ENTER);
  assertEquals(dialog.isActive(), false);
  assertEquals(dialog.getState(), "confirmed");

  const result = dialog.getResult();
  assertEquals(result.type, "confirmed");
  if (result.type === "confirmed") {
    assertEquals(result.value.proposalId, "test-proposal-1");
  }
});

Deno.test("ConfirmApproveDialog: 'y' shortcut confirms", () => {
  const proposal = createMockProposal();
  const dialog = new ConfirmApproveDialog(proposal);

  dialog.handleKey(KEY_Y);
  assertEquals(dialog.isActive(), false);
  assertEquals(dialog.getState(), "confirmed");
});

Deno.test("ConfirmApproveDialog: escape cancels", () => {
  const proposal = createMockProposal();
  const dialog = new ConfirmApproveDialog(proposal);

  dialog.handleKey(KEY_ESCAPE);
  assertEquals(dialog.isActive(), false);
  assertEquals(dialog.getState(), "cancelled");

  const result = dialog.getResult();
  assertEquals(result.type, "cancelled");
});

Deno.test("ConfirmApproveDialog: 'n' shortcut cancels", () => {
  const proposal = createMockProposal();
  const dialog = new ConfirmApproveDialog(proposal);

  dialog.handleKey(KEY_N);
  assertEquals(dialog.isActive(), false);
  assertEquals(dialog.getState(), "cancelled");
});

Deno.test("ConfirmApproveDialog: getProposal returns proposal", () => {
  const proposal = createMockProposal();
  const dialog = new ConfirmApproveDialog(proposal);

  const retrieved = dialog.getProposal();
  assertEquals(retrieved.id, "test-proposal-1");
  assertEquals(retrieved.learning.title, "Error Handling Pattern");
});

// ===== ConfirmRejectDialog Tests =====

Deno.test("ConfirmRejectDialog: renders correctly", () => {
  const proposal = createMockProposal();
  const dialog = new ConfirmRejectDialog(proposal);

  const rendered = dialog.render({ width: 80, height: 20, useColors: true }).join("\n");
  assertExists(rendered);
  assertEquals(rendered.includes("Reject Proposal"), true);
  assertEquals(rendered.includes("Error Handling Pattern"), true);
  assertEquals(rendered.includes("Reason"), true);
});

Deno.test("ConfirmRejectDialog: navigates with tab/arrow", () => {
  const proposal = createMockProposal();
  const dialog = new ConfirmRejectDialog(proposal);

  // Tab cycles through reason input, reject button, cancel button
  dialog.handleKey(KEY_TAB);
  dialog.handleKey(KEY_TAB);
  dialog.handleKey(KEY_TAB);
  // Should be back to reason input
  assertEquals(dialog.isActive(), true);
});

Deno.test("ConfirmRejectDialog: enters edit mode for reason", () => {
  const proposal = createMockProposal();
  const dialog = new ConfirmRejectDialog(proposal);

  dialog.handleKey(KEY_ENTER); // Enter edit mode on reason input
  dialog.handleKey(KEY_CAPITAL_N);
  dialog.handleKey(KEY_O);
  dialog.handleKey(KEY_T);
  dialog.handleKey(" ");
  dialog.handleKey(KEY_N);
  dialog.handleKey(KEY_E);
  dialog.handleKey(KEY_E);
  dialog.handleKey(KEY_D);
  dialog.handleKey(KEY_E);
  dialog.handleKey(KEY_D);

  assertEquals(dialog.getReason(), "Not needed");
});

Deno.test("ConfirmRejectDialog: backspace removes characters in edit mode", () => {
  const proposal = createMockProposal();
  const dialog = new ConfirmRejectDialog(proposal);

  dialog.handleKey(KEY_ENTER); // Enter edit mode
  dialog.handleKey(KEY_A);
  dialog.handleKey(KEY_B);
  dialog.handleKey(KEY_C);
  dialog.handleKey(KEY_BACKSPACE);
  assertEquals(dialog.getReason(), "ab");
});

Deno.test("ConfirmRejectDialog: escape exits edit mode", () => {
  const proposal = createMockProposal();
  const dialog = new ConfirmRejectDialog(proposal);

  dialog.handleKey(KEY_ENTER); // Enter edit mode
  dialog.handleKey(KEY_T);
  dialog.handleKey(KEY_E);
  dialog.handleKey(KEY_S);
  dialog.handleKey(KEY_T);
  dialog.handleKey(KEY_ESCAPE); // Exit edit mode

  // Dialog should still be active (not cancelled)
  assertEquals(dialog.isActive(), true);
  assertEquals(dialog.getReason(), "test");
});

Deno.test("ConfirmRejectDialog: confirms with reason", () => {
  const proposal = createMockProposal();
  const dialog = new ConfirmRejectDialog(proposal);

  // Navigate to reject button and confirm
  dialog.handleKey(KEY_TAB); // to reject button
  dialog.handleKey(KEY_ENTER);

  assertEquals(dialog.isActive(), false);
  const result = dialog.getResult();
  assertEquals(result.type, "confirmed");
  if (result.type === "confirmed") {
    assertEquals(result.value.proposalId, "test-proposal-1");
  }
});

// ===== AddLearningDialog Tests =====

Deno.test("AddLearningDialog: renders correctly", () => {
  const dialog = new AddLearningDialog();

  const rendered = dialog.render({ width: 80, height: 20, useColors: true }).join("\n");
  assertExists(rendered);
  assertEquals(rendered.includes("Add Learning"), true);
  assertEquals(rendered.includes("Title"), true);
  assertEquals(rendered.includes("Category"), true);
});

Deno.test("AddLearningDialog: uses default portal when provided", () => {
  const dialog = new AddLearningDialog("my-project");

  assertEquals(dialog.getScope(), MemoryScope.PROJECT);
});

Deno.test("AddLearningDialog: validates required fields", () => {
  const dialog = new AddLearningDialog();

  // Try to submit without title
  // Navigate to save button (field 6) and try to save
  for (let i = 0; i < 6; i++) {
    dialog.handleKey(KEY_TAB);
  }
  dialog.handleKey(KEY_ENTER);

  // Should still be active because validation failed
  assertEquals(dialog.isActive(), true);
});

Deno.test("AddLearningDialog: form fields can be edited", () => {
  const dialog = new AddLearningDialog();

  dialog.setTitle("Test Title");
  dialog.setCategory(LearningCategory.DECISION);
  dialog.setContent("Test content");
  dialog.setScope(MemoryScope.GLOBAL);

  assertEquals(dialog.getTitle(), "Test Title");
  assertEquals(dialog.getCategory(), LearningCategory.DECISION);
  assertEquals(dialog.getScope(), MemoryScope.GLOBAL);
});

Deno.test("AddLearningDialog: escape cancels", () => {
  const dialog = new AddLearningDialog();

  dialog.handleKey(KEY_ESCAPE);
  assertEquals(dialog.isActive(), false);
  assertEquals(dialog.getState(), "cancelled");
});

Deno.test("AddLearningDialog: getFocusableElements returns all fields", () => {
  const dialog = new AddLearningDialog();

  const elements = dialog.getFocusableElements();
  assertEquals(elements.length, 8);
  assertEquals(elements.includes("title-input"), true);
  assertEquals(elements.includes("category-select"), true);
  assertEquals(elements.includes("save-btn"), true);
  assertEquals(elements.includes("cancel-btn"), true);
});

// ===== PromoteDialog Tests =====

Deno.test("PromoteDialog: renders correctly", () => {
  const dialog = new PromoteDialog("Error Handling Pattern", "my-app");

  const rendered = dialog.render({ width: 80, height: 20, useColors: true }).join("\n");
  assertExists(rendered);
  assertEquals(rendered.includes("Promote to Global"), true);
  assertEquals(rendered.includes("Error Handling Pattern"), true);
  assertEquals(rendered.includes("my-app"), true);
});

Deno.test("PromoteDialog: shows explanation text", () => {
  const dialog = new PromoteDialog("Test Learning", "test-project");

  const rendered = dialog.render({ width: 80, height: 20, useColors: true }).join("\n");
  assertEquals(rendered.includes("copy the learning to Global Memory"), true);
  assertEquals(rendered.includes("original will remain"), true);
});

Deno.test("PromoteDialog: left/right switches focus", () => {
  const dialog = new PromoteDialog("Test", "proj");

  dialog.handleKey(KEY_RIGHT);
  const rendered = dialog.render({ width: 80, height: 20, useColors: true }).join("\n");
  assertEquals(rendered.includes("[Cancel]"), true);
});

Deno.test("PromoteDialog: enter confirms promotion", () => {
  const dialog = new PromoteDialog("Test Learning", "my-project");

  dialog.handleKey(KEY_ENTER);
  assertEquals(dialog.isActive(), false);

  const result = dialog.getResult();
  assertEquals(result.type, "confirmed");
  if (result.type === "confirmed") {
    assertEquals(result.value.learningTitle, "Test Learning");
    assertEquals(result.value.sourcePortal, "my-project");
  }
});

Deno.test("PromoteDialog: 'y' shortcut confirms", () => {
  const dialog = new PromoteDialog("Test", "proj");

  dialog.handleKey(KEY_Y);
  assertEquals(dialog.isActive(), false);
  assertEquals(dialog.getState(), "confirmed");
});

Deno.test("PromoteDialog: escape cancels", () => {
  const dialog = new PromoteDialog("Test", "proj");

  dialog.handleKey(KEY_ESCAPE);
  assertEquals(dialog.isActive(), false);
  assertEquals(dialog.getState(), "cancelled");
});

Deno.test("PromoteDialog: getters return correct values", () => {
  const dialog = new PromoteDialog("My Learning", "source-project");

  assertEquals(dialog.getLearningTitle(), "My Learning");
  assertEquals(dialog.getSourcePortal(), "source-project");
});

// ===== BulkApproveDialog Tests =====

Deno.test("BulkApproveDialog: renders correctly", () => {
  const dialog = new BulkApproveDialog(5);

  const rendered = dialog.render({ width: 80, height: 20, useColors: true }).join("\n");
  assertExists(rendered);
  assertEquals(rendered.includes("Approve All Proposals"), true);
  assertEquals(rendered.includes("5 proposal(s)"), true);
});

Deno.test("BulkApproveDialog: shows warning text", () => {
  const dialog = new BulkApproveDialog(3);

  const rendered = dialog.render({ width: 80, height: 20, useColors: true }).join("\n");
  assertEquals(rendered.includes("cannot be undone"), true);
});

Deno.test("BulkApproveDialog: left/right switches focus", () => {
  const dialog = new BulkApproveDialog(10);

  dialog.handleKey(KEY_RIGHT);
  const rendered = dialog.render({ width: 80, height: 20, useColors: true }).join("\n");
  assertEquals(rendered.includes("[Cancel]"), true);
});

Deno.test("BulkApproveDialog: enter confirms", () => {
  const dialog = new BulkApproveDialog(7);

  dialog.handleKey(KEY_ENTER);
  assertEquals(dialog.isActive(), false);

  const result = dialog.getResult();
  assertEquals(result.type, "confirmed");
  if (result.type === "confirmed") {
    assertEquals(result.value.count, 7);
  }
});

Deno.test("BulkApproveDialog: 'y' shortcut confirms", () => {
  const dialog = new BulkApproveDialog(3);

  dialog.handleKey(KEY_Y);
  assertEquals(dialog.isActive(), false);
  assertEquals(dialog.getState(), "confirmed");
});

Deno.test("BulkApproveDialog: escape cancels", () => {
  const dialog = new BulkApproveDialog(5);

  dialog.handleKey(KEY_ESCAPE);
  assertEquals(dialog.isActive(), false);
  assertEquals(dialog.getState(), "cancelled");
});

Deno.test("BulkApproveDialog: progress updates rendering", () => {
  const dialog = new BulkApproveDialog(10);

  dialog.setProgress(3);
  const rendered = dialog.render({ width: 80, height: 20, useColors: true }).join("\n");
  assertEquals(rendered.includes("Progress"), true);
  assertEquals(rendered.includes("3/10"), true);
});

Deno.test("BulkApproveDialog: getCount returns count", () => {
  const dialog = new BulkApproveDialog(42);

  assertEquals(dialog.getCount(), 42);
});

// ===== General Dialog Behavior Tests =====

Deno.test("All dialogs: getFocusableElements returns non-empty arrays", () => {
  const proposal = createMockProposal();

  const approve = new ConfirmApproveDialog(proposal);
  const reject = new ConfirmRejectDialog(proposal);
  const add = new AddLearningDialog();
  const promote = new PromoteDialog("Test", "proj");
  const bulk = new BulkApproveDialog(5);

  assertEquals(approve.getFocusableElements().length > 0, true);
  assertEquals(reject.getFocusableElements().length > 0, true);
  assertEquals(add.getFocusableElements().length > 0, true);
  assertEquals(promote.getFocusableElements().length > 0, true);
  assertEquals(bulk.getFocusableElements().length > 0, true);
});

Deno.test("All dialogs: render returns non-empty string", () => {
  const proposal = createMockProposal();

  const approve = new ConfirmApproveDialog(proposal);
  const reject = new ConfirmRejectDialog(proposal);
  const add = new AddLearningDialog();
  const promote = new PromoteDialog("Test", "proj");
  const bulk = new BulkApproveDialog(5);

  assertEquals(approve.render({ width: 80, height: 20, useColors: true }).length > 0, true);
  assertEquals(reject.render({ width: 80, height: 20, useColors: true }).length > 0, true);
  assertEquals(add.render({ width: 80, height: 20, useColors: true }).length > 0, true);
  assertEquals(promote.render({ width: 80, height: 20, useColors: true }).length > 0, true);
  assertEquals(bulk.render({ width: 80, height: 20, useColors: true }).length > 0, true);
});
