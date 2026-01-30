import type { Pane } from "../tui_dashboard.ts";
import type { MemoryNotification as TuiNotification, NotificationService } from "../../services/notification.ts";
import { closePane, maximizePane, resizePane, splitPane } from "../dashboard/pane_manager.ts";
import {
  KEY_1,
  KEY_7,
  KEY_C,
  KEY_CTRL_DOWN,
  KEY_CTRL_LEFT,
  KEY_CTRL_RIGHT,
  KEY_CTRL_UP,
  KEY_D,
  KEY_ENTER,
  KEY_ESCAPE,
  KEY_H,
  KEY_M,
  KEY_N,
  KEY_QUESTION,
  KEY_R,
  KEY_S,
  KEY_SHIFT_TAB,
  KEY_TAB,
  KEY_V,
  KEY_Z,
} from "../../config/constants.ts";

export interface ProdHandleCtx {
  prodState: any;
  panes: Pane[];
  views: any[];
  activePaneRef: { id: string };
  notificationService: NotificationService;
  addNotification: (message: string, type?: string) => Promise<void>;
  saveLayout: () => Promise<void> | void;
  restoreLayout: () => Promise<void> | void;
  resetToDefault: () => void;
}

/**
 * Handles key events for the production TUI (Text User Interface) environment.
 * Processes navigation, pane management, notification toggling, and memory notification actions
 * based on the provided key input and current context state.
 *
 * @param key - The key input string, which may be a single character, a named key, or an escape sequence.
 * @param ctx - The context object containing state, pane, view, and notification management utilities.
 * @returns A promise resolving to an object indicating whether to exit or re-render the UI.
 *
 * Key code notes:
 * - Keys starting with `\x1b` are escape sequences, commonly used for special keys in terminal environments.
 *   - `\x1b` is the Escape character (ESC).
 *   - `\x1b[A` is the Up Arrow key.
 *   - `\x1b[B` is the Down Arrow key.
 *   - `\x1b[Z` is Shift+Tab.
 *   - `\x1b[1;5D` is Ctrl+Left Arrow.
 *   - `\x1b[1;5C` is Ctrl+Right Arrow.
 *   - `\x1b[1;5A` is Ctrl+Up Arrow.
 *   - `\x1b[1;5B` is Ctrl+Down Arrow.
 *
 * Other key constants (e.g., KEY_N, KEY_M, KEY_QUESTION) are assumed to be defined elsewhere and represent
 * specific keyboard shortcuts for the TUI.
 */
export async function prodHandleKey(key: string, ctx: ProdHandleCtx): Promise<{ exit?: boolean; reRender?: boolean }> {
  const { prodState, panes, views, activePaneRef, notificationService, addNotification } = ctx;

  // Helper to find active pane index
  const findActiveIndex = () => panes.findIndex((p) => p.id === activePaneRef.id);

  // Memory notifications handling
  if (prodState.showMemoryNotifications) {
    if (key === "m" || key === "\x1b" || key === "esc") {
      prodState.showMemoryNotifications = false;
      return { reRender: true };
    }

    const allNotifs = await notificationService.getNotifications();
    const memoryNotifs = allNotifs.filter((n: TuiNotification) => n.type === "memory_update_pending");
    const count = memoryNotifs.length;

    if (key === "\x1b[A" || key === "k" || key === "up") { // Up
      if (count > 0) {
        prodState.selectedMemoryNotifIndex = (prodState.selectedMemoryNotifIndex - 1 + count) % count;
        return { reRender: true };
      }
    } else if (key === "\x1b[B" || key === "j" || key === "down") { // Down
      if (count > 0) {
        prodState.selectedMemoryNotifIndex = (prodState.selectedMemoryNotifIndex + 1) % count;
        return { reRender: true };
      }
    } else if ((key === "a" || key === "A") && count > 0) {
      const selected = memoryNotifs[prodState.selectedMemoryNotifIndex];
      await notificationService.notify(`Approved: ${selected.message}`, "success");
      await notificationService.clearNotification((selected.proposal_id || selected.id) as string);
      return { reRender: true };
    } else if ((key === "r" || key === "R") && count > 0) {
      const selected = memoryNotifs[prodState.selectedMemoryNotifIndex];
      await notificationService.notify(`Rejected: ${selected.message}`, "error");
      await notificationService.clearNotification((selected.proposal_id || selected.id) as string);
      return { reRender: true };
    }

    return { reRender: false };
  }

  // Notification panel handling
  if (prodState.showNotifications) {
    if (key === KEY_N || key === "\x1b" || key === KEY_ESCAPE) {
      prodState.showNotifications = false;
      return { reRender: true };
    }
    return { reRender: false };
  }

  // Top-level navigation and commands
  if (key === "\x1b") { // Esc
    return { exit: true };
  } else if (key === KEY_QUESTION) { // Help
    prodState.showHelp = true;
    return { reRender: true };
  } else if (key === KEY_N) { // Notifications toggle
    prodState.showNotifications = !prodState.showNotifications;
    return { reRender: true };
  } else if (key === KEY_M) { // Memory updates toggle
    prodState.showMemoryNotifications = !prodState.showMemoryNotifications;
    prodState.selectedMemoryNotifIndex = 0;
    return { reRender: true };
  } else if (key === "\t" || key === KEY_TAB) { // Tab
    const currentIndex = findActiveIndex();
    const nextIndex = (currentIndex + 1) % panes.length;
    activePaneRef.id = panes[nextIndex].id;
    panes.forEach((p) => p.focused = false);
    panes[nextIndex].focused = true;
    return { reRender: true };
  } else if (key === "\x1b[Z" || key === KEY_SHIFT_TAB) { // Shift+Tab
    const currentIndex = findActiveIndex();
    const prevIndex = (currentIndex - 1 + panes.length) % panes.length;
    activePaneRef.id = panes[prevIndex].id;
    panes.forEach((p) => p.focused = false);
    panes[prevIndex].focused = true;
    return { reRender: true };
  } else if (key >= KEY_1 && key <= KEY_7) { // Direct pane jump
    const idx = parseInt(key) - 1;
    if (idx < panes.length) {
      panes.forEach((p) => p.focused = false);
      panes[idx].focused = true;
      activePaneRef.id = panes[idx].id;
      return { reRender: true };
    }
    return { reRender: false };
  } else if (key === KEY_V) { // Split vertical
    await splitPane(panes, activePaneRef.id, views, "vertical", addNotification);
    return { reRender: true };
  } else if (key === KEY_H) { // Split horizontal
    await splitPane(panes, activePaneRef.id, views, "horizontal", addNotification);
    return { reRender: true };
  } else if (key === KEY_C) { // Close pane
    const result = await closePane(panes, activePaneRef.id, activePaneRef.id, addNotification);
    activePaneRef.id = result.activePaneId;
    return { reRender: true };
  } else if (key === KEY_Z) { // Maximize/restore
    maximizePane(panes, activePaneRef.id, addNotification);
    return { reRender: true };
  } else if (key === "\x1b[1;5D" || key === KEY_CTRL_LEFT) { // Ctrl+Left
    resizePane(panes, activePaneRef.id, -0.05, 0);
    return { reRender: true };
  } else if (key === "\x1b[1;5C" || key === KEY_CTRL_RIGHT) { // Ctrl+Right
    resizePane(panes, activePaneRef.id, 0.05, 0);
    return { reRender: true };
  } else if (key === "\x1b[1;5A" || key === KEY_CTRL_UP) { // Ctrl+Up
    resizePane(panes, activePaneRef.id, 0, -0.05);
    return { reRender: true };
  } else if (key === "\x1b[1;5B" || key === KEY_CTRL_DOWN) { // Ctrl+Down
    resizePane(panes, activePaneRef.id, 0, 0.05);
    return { reRender: true };
  } else if (key === "\n" || key === KEY_ENTER) {
    // Enter: show selected pane info (no-op for helper)
    return { reRender: true };
  } else if (key === KEY_S) {
    await ctx.saveLayout();
    return { reRender: true };
  } else if (key === KEY_R) {
    await ctx.restoreLayout();
    return { reRender: true };
  } else if (key === KEY_D) {
    ctx.resetToDefault();
    return { reRender: true };
  }

  // No-op for unrecognized keys
  return { reRender: false };
}

export default prodHandleKey;
