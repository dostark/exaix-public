/**
 * Pane Manager for TUI Dashboard
 * Extracted from tui_dashboard.ts to reduce complexity
 */

import type { Pane } from "../tui_dashboard.ts";

/**
 * Split a pane in the specified direction
 */
export async function splitPane(
  panes: Pane[],
  activePaneId: string,
  views: any[],
  direction: "vertical" | "horizontal",
  notify: (message: string, type?: string) => Promise<void>,
): Promise<{ panes: Pane[]; activePaneId: string }> {
  const activePane = panes.find((p) => p.id === activePaneId);
  if (!activePane) return { panes, activePaneId };

  const newId = `pane-${panes.length}`;
  if (direction === "vertical") {
    // Split vertically: left-right
    const halfWidth = Math.floor(activePane.width / 2);
    activePane.width = halfWidth;
    const newPane: Pane = {
      id: newId,
      view: views[1] || views[0], // Default to next view or first
      x: activePane.x + halfWidth,
      y: activePane.y,
      width: activePane.width,
      height: activePane.height,
      focused: false,
      maximized: false,
    };
    panes.push(newPane);
  } else {
    // Split horizontally: top-bottom
    const halfHeight = Math.floor(activePane.height / 2);
    activePane.height = halfHeight;
    const newPane: Pane = {
      id: newId,
      view: views[1] || views[0],
      x: activePane.x,
      y: activePane.y + halfHeight,
      width: activePane.width,
      height: activePane.height,
      focused: false,
      maximized: false,
    };
    panes.push(newPane);
  }

  await notify(`Pane split ${direction}`, "info");
  return { panes, activePaneId };
}

/**
 * Close a pane
 */
export async function closePane(
  panes: Pane[],
  activePaneId: string,
  paneId: string,
  notify: (message: string, type?: string) => Promise<void>,
): Promise<{ panes: Pane[]; activePaneId: string }> {
  const index = panes.findIndex((p) => p.id === paneId);
  if (index === -1 || panes.length === 1) return { panes, activePaneId }; // Can't close last pane

  panes.splice(index, 1);
  let newActivePaneId = activePaneId;

  if (activePaneId === paneId) {
    newActivePaneId = panes[0].id;
    panes[0].focused = true;
  }

  await notify("Pane closed", "info");
  return { panes, activePaneId: newActivePaneId };
}

/**
 * Resize a pane
 */
export function resizePane(
  panes: Pane[],
  paneId: string,
  deltaWidth: number,
  deltaHeight: number,
): void {
  const pane = panes.find((p) => p.id === paneId);
  if (pane) {
    pane.width = Math.max(10, pane.width + deltaWidth);
    pane.height = Math.max(5, pane.height + deltaHeight);
  }
}

/**
 * Switch focus to a pane
 */
export function switchPane(
  panes: Pane[],
  paneId: string,
): string {
  const pane = panes.find((p) => p.id === paneId);
  if (pane) {
    panes.forEach((p) => p.focused = false);
    pane.focused = true;
    return paneId;
  }
  return "";
}

/**
 * Maximize or restore a pane
 */
export function maximizePane(
  panes: Pane[],
  paneId: string,
  notify: (message: string, type?: string) => Promise<void>,
): void {
  const pane = panes.find((p) => p.id === paneId);
  if (!pane) return;

  if (pane.maximized) {
    // Restore
    if (pane.previousBounds) {
      pane.x = pane.previousBounds.x;
      pane.y = pane.previousBounds.y;
      pane.width = pane.previousBounds.width;
      pane.height = pane.previousBounds.height;
    }
    pane.maximized = false;
    notify("Pane restored", "info");
  } else {
    // Maximize
    pane.previousBounds = { x: pane.x, y: pane.y, width: pane.width, height: pane.height };
    pane.x = 0;
    pane.y = 0;
    pane.width = 80;
    pane.height = 24;
    pane.maximized = true;
    notify("Pane maximized", "info");
  }
}
