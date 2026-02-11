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

import { assertEquals, assertExists } from "@std/assert";
import { DialogStatus, LearningCategory, MemoryScope } from "../../src/enums.ts";
import { KEYS } from "../../src/helpers/keyboard.ts";
import {
  AddLearningDialog,
  BulkApproveDialog,
  ConfirmApproveDialog,
  ConfirmRejectDialog,
  PromoteDialog,
} from "../../src/tui/dialogs/memory_dialogs.ts";
import { createMockProposal, renderDialog } from "./memory_view/memory_view_test_utils.ts";

// ===== ConfirmApproveDialog Tests =====

Deno.test("ConfirmApproveDialog: renders correctly", () => {
  const proposal = createMockProposal("test-proposal-1", "Error Handling Pattern");
  const dialog = new ConfirmApproveDialog(proposal);

  const rendered = renderDialog(dialog);
  assertExists(rendered);
  assertEquals(rendered.includes("Approve Proposal"), true);
  assertEquals(rendered.includes("Error Handling Pattern"), true);
  assertEquals(rendered.includes(MemoryScope.PROJECT), true);
});

Deno.test("ConfirmApproveDialog: starts active", () => {
  const proposal = createMockProposal("test-proposal-1", "Title");
  const dialog = new ConfirmApproveDialog(proposal);

  assertEquals(dialog.isActive(), true);
  assertEquals(dialog.getState(), DialogStatus.ACTIVE);
});

Deno.test("ConfirmApproveDialog: left/right switches focus", () => {
  const proposal = createMockProposal("test-proposal-1", "Title");
  const dialog = new ConfirmApproveDialog(proposal);

  dialog.handleKey(KEYS.RIGHT);
  const rendered1 = renderDialog(dialog);
  assertEquals(rendered1.includes("[No, Cancel]"), true);

  dialog.handleKey(KEYS.RIGHT);
  const rendered2 = renderDialog(dialog);
  assertEquals(rendered2.includes("[Yes, Approve]"), true);
});

Deno.test("ConfirmApproveDialog: enter on approve confirms", () => {
  const proposal = createMockProposal("test-proposal-1", "Title");
  const dialog = new ConfirmApproveDialog(proposal);

  dialog.handleKey(KEYS.ENTER);
  assertEquals(dialog.isActive(), false);
  assertEquals(dialog.getState(), DialogStatus.CONFIRMED);

  const result = dialog.getResult();
  assertEquals(result.type, DialogStatus.CONFIRMED);
  if (result.type === DialogStatus.CONFIRMED) {
    assertEquals(result.value.proposalId, "test-proposal-1");
  }
});

Deno.test("ConfirmApproveDialog: 'y' shortcut confirms", () => {
  const proposal = createMockProposal("test-proposal-1", "Title");
  const dialog = new ConfirmApproveDialog(proposal);

  dialog.handleKey(KEYS.Y);
  assertEquals(dialog.isActive(), false);
  assertEquals(dialog.getState(), DialogStatus.CONFIRMED);
});

Deno.test("ConfirmApproveDialog: escape cancels", () => {
  const proposal = createMockProposal("test-proposal-1", "Title");
  const dialog = new ConfirmApproveDialog(proposal);

  dialog.handleKey(KEYS.ESCAPE);
  assertEquals(dialog.isActive(), false);
  assertEquals(dialog.getState(), DialogStatus.CANCELLED);

  const result = dialog.getResult();
  assertEquals(result.type, DialogStatus.CANCELLED);
});

Deno.test("ConfirmApproveDialog: 'n' shortcut cancels", () => {
  const proposal = createMockProposal("test-proposal-1", "Title");
  const dialog = new ConfirmApproveDialog(proposal);

  dialog.handleKey(KEYS.N);
  assertEquals(dialog.isActive(), false);
  assertEquals(dialog.getState(), DialogStatus.CANCELLED);
});

Deno.test("ConfirmApproveDialog: getProposal returns proposal", () => {
  const proposal = createMockProposal("test-proposal-1", "Error Handling Pattern");
  const dialog = new ConfirmApproveDialog(proposal);

  const retrieved = dialog.getProposal();
  assertEquals(retrieved.id, "test-proposal-1");
  assertEquals(retrieved.learning.title, "Error Handling Pattern");
});

// ===== ConfirmRejectDialog Tests =====

Deno.test("ConfirmRejectDialog: renders correctly", () => {
  const proposal = createMockProposal("test-proposal-1", "Error Handling Pattern");
  const dialog = new ConfirmRejectDialog(proposal);

  const rendered = renderDialog(dialog);
  assertExists(rendered);
  assertEquals(rendered.includes("Reject Proposal"), true);
  assertEquals(rendered.includes("Error Handling Pattern"), true);
  assertEquals(rendered.includes("Reason"), true);
});

Deno.test("ConfirmRejectDialog: navigates with tab/arrow", () => {
  const proposal = createMockProposal("test-proposal-1", "Title");
  const dialog = new ConfirmRejectDialog(proposal);

  // Tab cycles through reason input, reject button, cancel button
  dialog.handleKey(KEYS.TAB);
  dialog.handleKey(KEYS.TAB);
  dialog.handleKey(KEYS.TAB);
  // Should be back to reason input
  assertEquals(dialog.isActive(), true);
});

Deno.test("ConfirmRejectDialog: enters edit mode for reason", () => {
  const proposal = createMockProposal("test-proposal-1", "Title");
  const dialog = new ConfirmRejectDialog(proposal);

  dialog.handleKey(KEYS.ENTER); // Enter edit mode on reason input
  dialog.handleKey(KEYS.CAP_N);
  dialog.handleKey(KEYS.O);
  dialog.handleKey(KEYS.T);
  dialog.handleKey(" ");
  dialog.handleKey(KEYS.N);
  dialog.handleKey(KEYS.E);
  dialog.handleKey(KEYS.E);
  dialog.handleKey(KEYS.D);
  dialog.handleKey(KEYS.E);
  dialog.handleKey(KEYS.D);

  assertEquals(dialog.getReason(), "Not needed");
});

Deno.test("ConfirmRejectDialog: backspace removes characters in edit mode", () => {
  const proposal = createMockProposal("test-proposal-1", "Title");
  const dialog = new ConfirmRejectDialog(proposal);

  dialog.handleKey(KEYS.ENTER); // Enter edit mode
  dialog.handleKey(KEYS.A);
  dialog.handleKey(KEYS.B);
  dialog.handleKey(KEYS.C);
  dialog.handleKey(KEYS.BACKSPACE);
  assertEquals(dialog.getReason(), "ab");
});

Deno.test("ConfirmRejectDialog: escape exits edit mode", () => {
  const proposal = createMockProposal("test-proposal-1", "Title");
  const dialog = new ConfirmRejectDialog(proposal);

  dialog.handleKey(KEYS.ENTER); // Enter edit mode
  dialog.handleKey(KEYS.T);
  dialog.handleKey(KEYS.E);
  dialog.handleKey(KEYS.S);
  dialog.handleKey(KEYS.T);
  dialog.handleKey(KEYS.ESCAPE); // Exit edit mode

  // Dialog should still be active (not cancelled)
  assertEquals(dialog.isActive(), true);
  assertEquals(dialog.getReason(), "test");
});

Deno.test("ConfirmRejectDialog: confirms with reason", () => {
  const proposal = createMockProposal("test-proposal-1", "Title");
  const dialog = new ConfirmRejectDialog(proposal);

  // Navigate to reject button and confirm
  dialog.handleKey(KEYS.TAB); // to reject button
  dialog.handleKey(KEYS.ENTER);

  assertEquals(dialog.isActive(), false);
  const result = dialog.getResult();
  assertEquals(result.type, DialogStatus.CONFIRMED);
  if (result.type === DialogStatus.CONFIRMED) {
    assertEquals(result.value.proposalId, "test-proposal-1");
  }
});

// ===== AddLearningDialog Tests =====

Deno.test("AddLearningDialog: renders correctly", () => {
  const dialog = new AddLearningDialog();

  const rendered = renderDialog(dialog);
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
    dialog.handleKey(KEYS.TAB);
  }
  dialog.handleKey(KEYS.ENTER);

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

  dialog.handleKey(KEYS.ESCAPE);
  assertEquals(dialog.isActive(), false);
  assertEquals(dialog.getState(), DialogStatus.CANCELLED);
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

  const rendered = renderDialog(dialog);
  assertExists(rendered);
  assertEquals(rendered.includes("Promote to Global"), true);
  assertEquals(rendered.includes("Error Handling Pattern"), true);
  assertEquals(rendered.includes("my-app"), true);
});

Deno.test("PromoteDialog: shows explanation text", () => {
  const dialog = new PromoteDialog("Test Learning", "test-project");

  const rendered = renderDialog(dialog);
  assertEquals(rendered.includes("copy the learning to Global Memory"), true);
  assertEquals(rendered.includes("original will remain"), true);
});

Deno.test("PromoteDialog: left/right switches focus", () => {
  const dialog = new PromoteDialog("Test", "proj");

  dialog.handleKey(KEYS.RIGHT);
  const rendered = renderDialog(dialog);
  assertEquals(rendered.includes("[Cancel]"), true);
});

Deno.test("PromoteDialog: enter confirms promotion", () => {
  const dialog = new PromoteDialog("Test Learning", "my-project");

  dialog.handleKey(KEYS.ENTER);
  assertEquals(dialog.isActive(), false);

  const result = dialog.getResult();
  assertEquals(result.type, DialogStatus.CONFIRMED);
  if (result.type === DialogStatus.CONFIRMED) {
    assertEquals(result.value.learningTitle, "Test Learning");
    assertEquals(result.value.sourcePortal, "my-project");
  }
});

Deno.test("PromoteDialog: 'y' shortcut confirms", () => {
  const dialog = new PromoteDialog("Test", "proj");

  dialog.handleKey(KEYS.Y);
  assertEquals(dialog.isActive(), false);
  assertEquals(dialog.getState(), DialogStatus.CONFIRMED);
});

Deno.test("PromoteDialog: escape cancels", () => {
  const dialog = new PromoteDialog("Test", "proj");

  dialog.handleKey(KEYS.ESCAPE);
  assertEquals(dialog.isActive(), false);
  assertEquals(dialog.getState(), DialogStatus.CANCELLED);
});

Deno.test("PromoteDialog: getters return correct values", () => {
  const dialog = new PromoteDialog("My Learning", "source-project");

  assertEquals(dialog.getLearningTitle(), "My Learning");
  assertEquals(dialog.getSourcePortal(), "source-project");
});

// ===== BulkApproveDialog Tests =====

Deno.test("BulkApproveDialog: renders correctly", () => {
  const dialog = new BulkApproveDialog(5);

  const rendered = renderDialog(dialog);
  assertExists(rendered);
  assertEquals(rendered.includes("Approve All Proposals"), true);
  assertEquals(rendered.includes("5 proposal(s)"), true);
});

Deno.test("BulkApproveDialog: shows warning text", () => {
  const dialog = new BulkApproveDialog(3);

  const rendered = renderDialog(dialog);
  assertEquals(rendered.includes("cannot be undone"), true);
});

Deno.test("BulkApproveDialog: left/right switches focus", () => {
  const dialog = new BulkApproveDialog(10);

  dialog.handleKey(KEYS.RIGHT);
  const rendered = renderDialog(dialog);
  assertEquals(rendered.includes("[Cancel]"), true);
});

Deno.test("BulkApproveDialog: enter confirms", () => {
  const dialog = new BulkApproveDialog(7);

  dialog.handleKey(KEYS.ENTER);
  assertEquals(dialog.isActive(), false);

  const result = dialog.getResult();
  assertEquals(result.type, DialogStatus.CONFIRMED);
  if (result.type === DialogStatus.CONFIRMED) {
    assertEquals(result.value.count, 7);
  }
});

Deno.test("BulkApproveDialog: 'y' shortcut confirms", () => {
  const dialog = new BulkApproveDialog(3);

  dialog.handleKey(KEYS.Y);
  assertEquals(dialog.isActive(), false);
  assertEquals(dialog.getState(), DialogStatus.CONFIRMED);
});

Deno.test("BulkApproveDialog: escape cancels", () => {
  const dialog = new BulkApproveDialog(5);

  dialog.handleKey(KEYS.ESCAPE);
  assertEquals(dialog.isActive(), false);
  assertEquals(dialog.getState(), DialogStatus.CANCELLED);
});

Deno.test("BulkApproveDialog: progress updates rendering", () => {
  const dialog = new BulkApproveDialog(10);

  dialog.setProgress(3);
  const rendered = renderDialog(dialog);
  assertEquals(rendered.includes("Progress"), true);
  assertEquals(rendered.includes("3/10"), true);
});

Deno.test("BulkApproveDialog: getCount returns count", () => {
  const dialog = new BulkApproveDialog(42);

  assertEquals(dialog.getCount(), 42);
});

// ===== General Dialog Behavior Tests =====

Deno.test("All dialogs: getFocusableElements returns non-empty arrays", () => {
  const proposal = createMockProposal("id", "Title");

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
  const proposal = createMockProposal("id", "Title");

  const approve = new ConfirmApproveDialog(proposal);
  const reject = new ConfirmRejectDialog(proposal);
  const add = new AddLearningDialog();
  const promote = new PromoteDialog("Test", "proj");
  const bulk = new BulkApproveDialog(5);

  assertEquals(renderDialog(approve).length > 0, true);
  assertEquals(renderDialog(reject).length > 0, true);
  assertEquals(renderDialog(add).length > 0, true);
  assertEquals(renderDialog(promote).length > 0, true);
  assertEquals(renderDialog(bulk).length > 0, true);
});
