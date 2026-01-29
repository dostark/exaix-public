import type { Pane } from "../tui_dashboard.ts";
import type { MemoryNotification as TuiNotification, NotificationService } from "../../services/notification.ts";
import { closePane, maximizePane, resizePane, splitPane } from "../dashboard/pane_manager.ts";

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
    if (key === "n" || key === "\x1b" || key === "esc") {
      prodState.showNotifications = false;
      return { reRender: true };
    }
    return { reRender: false };
  }

  // Top-level navigation and commands
  if (key === "\x1b") { // Esc
    return { exit: true };
  } else if (key === "?") { // Help
    prodState.showHelp = true;
    return { reRender: true };
  } else if (key === "n") { // Notifications toggle
    prodState.showNotifications = !prodState.showNotifications;
    return { reRender: true };
  } else if (key === "m") { // Memory updates toggle
    prodState.showMemoryNotifications = !prodState.showMemoryNotifications;
    prodState.selectedMemoryNotifIndex = 0;
    return { reRender: true };
  } else if (key === "\t" || key === "tab") { // Tab
    const currentIndex = findActiveIndex();
    const nextIndex = (currentIndex + 1) % panes.length;
    activePaneRef.id = panes[nextIndex].id;
    panes.forEach((p) => p.focused = false);
    panes[nextIndex].focused = true;
    return { reRender: true };
  } else if (key === "\x1b[Z" || key === "shift+tab" || key === "shift-tab") { // Shift+Tab
    const currentIndex = findActiveIndex();
    const prevIndex = (currentIndex - 1 + panes.length) % panes.length;
    activePaneRef.id = panes[prevIndex].id;
    panes.forEach((p) => p.focused = false);
    panes[prevIndex].focused = true;
    return { reRender: true };
  } else if (key >= "1" && key <= "7") { // Direct pane jump
    const idx = parseInt(key) - 1;
    if (idx < panes.length) {
      panes.forEach((p) => p.focused = false);
      panes[idx].focused = true;
      activePaneRef.id = panes[idx].id;
      return { reRender: true };
    }
    return { reRender: false };
  } else if (key === "v") { // Split vertical
    await splitPane(panes, activePaneRef.id, views, "vertical", addNotification);
    return { reRender: true };
  } else if (key === "h") { // Split horizontal
    await splitPane(panes, activePaneRef.id, views, "horizontal", addNotification);
    return { reRender: true };
  } else if (key === "c") { // Close pane
    const result = await closePane(panes, activePaneRef.id, activePaneRef.id, addNotification);
    activePaneRef.id = result.activePaneId;
    return { reRender: true };
  } else if (key === "z") { // Maximize/restore
    maximizePane(panes, activePaneRef.id, addNotification);
    return { reRender: true };
  } else if (key === "\x1b[1;5D" || key === "ctrl+left") { // Ctrl+Left
    resizePane(panes, activePaneRef.id, -0.05, 0);
    return { reRender: true };
  } else if (key === "\x1b[1;5C" || key === "ctrl+right") { // Ctrl+Right
    resizePane(panes, activePaneRef.id, 0.05, 0);
    return { reRender: true };
  } else if (key === "\x1b[1;5A" || key === "ctrl+up") { // Ctrl+Up
    resizePane(panes, activePaneRef.id, 0, -0.05);
    return { reRender: true };
  } else if (key === "\x1b[1;5B" || key === "ctrl+down") { // Ctrl+Down
    resizePane(panes, activePaneRef.id, 0, 0.05);
    return { reRender: true };
  } else if (key === "\n" || key === "enter") {
    // Enter: show selected pane info (no-op for helper)
    return { reRender: true };
  } else if (key === "s") {
    await ctx.saveLayout();
    return { reRender: true };
  } else if (key === "r") {
    await ctx.restoreLayout();
    return { reRender: true };
  } else if (key === "d") {
    ctx.resetToDefault();
    return { reRender: true };
  }

  // No-op for unrecognized keys
  return { reRender: false };
}

export default prodHandleKey;
