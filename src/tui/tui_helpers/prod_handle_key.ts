import type { Pane } from "../tui_dashboard.ts";
import type { MemoryNotification as TuiNotification, NotificationService } from "../../services/notification.ts";

export interface ProdHandleCtx {
  prodState: any;
  panes: Pane[];
  views: any[];
  activePaneRef: { id: string };
  notificationService: NotificationService;
  addNotification: (message: string, type?: "info" | "success" | "warning" | "error") => void;
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
    const activePane = panes.find((p) => p.id === activePaneRef.id);
    if (activePane && panes.length < 4) {
      const newId = `pane-${panes.length}`;
      const halfWidth = Math.floor(activePane.width / 2);
      activePane.width = halfWidth;
      const newPane: Pane = {
        id: newId,
        view: views[panes.length % views.length],
        x: activePane.x + halfWidth,
        y: activePane.y,
        width: activePane.width,
        height: activePane.height,
        focused: false,
        maximized: false,
      };
      panes.push(newPane);
      addNotification("Pane split vertically", "info");
    }
    return { reRender: true };
  } else if (key === "h") { // Split horizontal
    const activePane = panes.find((p) => p.id === activePaneRef.id);
    if (activePane && panes.length < 4) {
      const newId = `pane-${panes.length}`;
      const halfHeight = Math.floor(activePane.height / 2);
      activePane.height = halfHeight;
      const newPane: Pane = {
        id: newId,
        view: views[panes.length % views.length],
        x: activePane.x,
        y: activePane.y + halfHeight,
        width: activePane.width,
        height: activePane.height,
        focused: false,
        maximized: false,
      };
      panes.push(newPane);
      addNotification("Pane split horizontally", "info");
    }
    return { reRender: true };
  } else if (key === "c") { // Close pane
    if (panes.length > 1) {
      const index = panes.findIndex((p) => p.id === activePaneRef.id);
      panes.splice(index, 1);
      activePaneRef.id = panes[0].id;
      panes[0].focused = true;
      addNotification("Pane closed", "info");
    }
    return { reRender: true };
  } else if (key === "z") { // Maximize/restore
    const activePane = panes.find((p) => p.id === activePaneRef.id);
    if (activePane) {
      if (activePane.maximized) {
        if (activePane.previousBounds) {
          activePane.x = activePane.previousBounds.x;
          activePane.y = activePane.previousBounds.y;
          activePane.width = activePane.previousBounds.width;
          activePane.height = activePane.previousBounds.height;
        }
        activePane.maximized = false;
        addNotification("Pane restored", "info");
      } else {
        activePane.previousBounds = {
          x: activePane.x,
          y: activePane.y,
          width: activePane.width,
          height: activePane.height,
        };
        activePane.x = 0;
        activePane.y = 0;
        activePane.width = 80;
        activePane.height = 24;
        activePane.maximized = true;
        addNotification("Pane maximized", "info");
      }
    }
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
