/**
 * Pane Manager for TUI Dashboard
 * Extracted from tui_dashboard.ts to reduce complexity
 */

import { TUI_LAYOUT_DEFAULT_HEIGHT, TUI_LAYOUT_FULL_WIDTH } from "../utils/constants.ts";

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
    const halfFlexWidth = activePane.flexWidth / 2;
    const halfWidth = Math.floor(activePane.width / 2);

    const newPane: Pane = {
      id: newId,
      view: views[1] || views[0],
      flexX: activePane.flexX + halfFlexWidth,
      flexY: activePane.flexY,
      flexWidth: halfFlexWidth,
      flexHeight: activePane.flexHeight,
      x: activePane.x + halfWidth,
      y: activePane.y,
      width: halfWidth,
      height: activePane.height,
      focused: false,
      maximized: false,
    };

    activePane.flexWidth = halfFlexWidth;
    activePane.width = halfWidth;
    panes.push(newPane);
  } else {
    // Split horizontally: top-bottom
    const halfFlexHeight = activePane.flexHeight / 2;
    const halfHeight = Math.floor(activePane.height / 2);

    const newPane: Pane = {
      id: newId,
      view: views[1] || views[0],
      flexX: activePane.flexX,
      flexY: activePane.flexY + halfFlexHeight,
      flexWidth: activePane.flexWidth,
      flexHeight: halfFlexHeight,
      x: activePane.x,
      y: activePane.y + halfHeight,
      width: activePane.width,
      height: halfHeight,
      focused: false,
      maximized: false,
    };

    activePane.flexHeight = halfFlexHeight;
    activePane.height = halfHeight;
    panes.push(newPane);
  }

  await notify(`Pane split ${direction}`, "info");
  return { panes, activePaneId };
}

/**
 * Close a pane and merge its space back into a neighbor
 */
export async function closePane(
  panes: Pane[],
  activePaneId: string,
  paneId: string,
  notify: (message: string, type?: string) => Promise<void>,
): Promise<{ panes: Pane[]; activePaneId: string }> {
  const index = panes.findIndex((p) => p.id === paneId);
  if (index === -1 || panes.length === 1) return { panes, activePaneId };

  const closingPane = panes[index];

  // Try to find a neighbor to merge into
  // 1. Check for a sibling to the left
  const leftSibling = panes.find((p) =>
    p.id !== closingPane.id &&
    Math.abs((p.flexX + p.flexWidth) - closingPane.flexX) < 0.01 &&
    Math.abs(p.flexY - closingPane.flexY) < 0.01 &&
    Math.abs(p.flexHeight - closingPane.flexHeight) < 0.01
  );

  if (leftSibling) {
    leftSibling.flexWidth += closingPane.flexWidth;
  } else {
    // 2. Check for a sibling to the right
    const rightSibling = panes.find((p) =>
      p.id !== closingPane.id &&
      Math.abs(p.flexX - (closingPane.flexX + closingPane.flexWidth)) < 0.01 &&
      Math.abs(p.flexY - closingPane.flexY) < 0.01 &&
      Math.abs(p.flexHeight - closingPane.flexHeight) < 0.01
    );
    if (rightSibling) {
      rightSibling.flexX = closingPane.flexX;
      rightSibling.flexWidth += closingPane.flexWidth;
    } else {
      // 3. Check for a sibling above
      const topSibling = panes.find((p) =>
        p.id !== closingPane.id &&
        Math.abs((p.flexY + p.flexHeight) - closingPane.flexY) < 0.01 &&
        Math.abs(p.flexX - closingPane.flexX) < 0.01 &&
        Math.abs(p.flexWidth - closingPane.flexWidth) < 0.01
      );
      if (topSibling) {
        topSibling.flexHeight += closingPane.flexHeight;
      } else {
        // 4. Check for a sibling below
        const bottomSibling = panes.find((p) =>
          p.id !== closingPane.id &&
          Math.abs(p.flexY - (closingPane.flexY + closingPane.flexHeight)) < 0.01 &&
          Math.abs(p.flexX - closingPane.flexX) < 0.01 &&
          Math.abs(p.flexWidth - closingPane.flexWidth) < 0.01
        );
        if (bottomSibling) {
          bottomSibling.flexY = closingPane.flexY;
          bottomSibling.flexHeight += closingPane.flexHeight;
        }
      }
    }
  }

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
 * Resize a pane by adjusting flex values and its neighbors
 */
export function resizePane(
  panes: Pane[],
  paneId: string,
  deltaFlexWidth: number,
  deltaFlexHeight: number,
): void {
  const pane = panes.find((p) => p.id === paneId);
  if (!pane || pane.maximized) return;

  const MIN_FLEX = 0.1;

  if (deltaFlexWidth !== 0) {
    const oldFlexWidth = pane.flexWidth;
    const newFlexWidth = Math.max(MIN_FLEX, Math.min(0.9, pane.flexWidth + deltaFlexWidth));
    const actualDelta = newFlexWidth - oldFlexWidth;

    if (actualDelta !== 0) {
      // Find sibling to the right (shares left edge with our right edge)
      const rightSibling = panes.find((p) =>
        p.id !== pane.id &&
        Math.abs(p.flexX - (pane.flexX + pane.flexWidth)) < 0.01 &&
        Math.abs(p.flexY - pane.flexY) < 0.01 &&
        Math.abs(p.flexHeight - pane.flexHeight) < 0.01
      );

      if (rightSibling) {
        if (rightSibling.flexWidth - actualDelta >= MIN_FLEX) {
          pane.flexWidth = newFlexWidth;
          rightSibling.flexX += actualDelta;
          rightSibling.flexWidth -= actualDelta;
        }
      } else {
        // Find sibling to the left (shares right edge with our left edge)
        const leftSibling = panes.find((p) =>
          p.id !== pane.id &&
          Math.abs((p.flexX + p.flexWidth) - pane.flexX) < 0.01 &&
          Math.abs(p.flexY - pane.flexY) < 0.01 &&
          Math.abs(p.flexHeight - pane.flexHeight) < 0.01
        );

        if (leftSibling) {
          if (leftSibling.flexWidth - actualDelta >= MIN_FLEX) {
            pane.flexX -= actualDelta;
            pane.flexWidth = newFlexWidth;
            leftSibling.flexWidth -= actualDelta;
          }
        }
      }
    }
  }

  if (deltaFlexHeight !== 0) {
    const oldFlexHeight = pane.flexHeight;
    const newFlexHeight = Math.max(MIN_FLEX, Math.min(0.9, pane.flexHeight + deltaFlexHeight));
    const actualDelta = newFlexHeight - oldFlexHeight;

    if (actualDelta !== 0) {
      // Find sibling below
      const bottomSibling = panes.find((p) =>
        p.id !== pane.id &&
        Math.abs(p.flexY - (pane.flexY + pane.flexHeight)) < 0.01 &&
        Math.abs(p.flexX - pane.flexX) < 0.01 &&
        Math.abs(p.flexWidth - pane.flexWidth) < 0.01
      );

      if (bottomSibling) {
        if (bottomSibling.flexHeight - actualDelta >= MIN_FLEX) {
          pane.flexHeight = newFlexHeight;
          bottomSibling.flexY += actualDelta;
          bottomSibling.flexHeight -= actualDelta;
        }
      } else {
        // Find sibling above
        const topSibling = panes.find((p) =>
          p.id !== pane.id &&
          Math.abs((p.flexY + p.flexHeight) - pane.flexY) < 0.01 &&
          Math.abs(p.flexX - pane.flexX) < 0.01 &&
          Math.abs(p.flexWidth - pane.flexWidth) < 0.01
        );

        if (topSibling) {
          if (topSibling.flexHeight - actualDelta >= MIN_FLEX) {
            pane.flexY -= actualDelta;
            pane.flexHeight = newFlexHeight;
            topSibling.flexHeight -= actualDelta;
          }
        }
      }
    }
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
      pane.flexX = pane.previousBounds.flexX;
      pane.flexY = pane.previousBounds.flexY;
      pane.flexWidth = pane.previousBounds.flexWidth;
      pane.flexHeight = pane.previousBounds.flexHeight;
      pane.x = pane.previousBounds.x;
      pane.y = pane.previousBounds.y;
      pane.width = pane.previousBounds.width;
      pane.height = pane.previousBounds.height;
    }
    pane.maximized = false;
    notify("Pane restored", "info");
  } else {
    // Maximize
    pane.previousBounds = {
      flexX: pane.flexX,
      flexY: pane.flexY,
      flexWidth: pane.flexWidth,
      flexHeight: pane.flexHeight,
      x: pane.x,
      y: pane.y,
      width: pane.width,
      height: pane.height,
    };
    pane.flexX = 0;
    pane.flexY = 0;
    pane.flexWidth = 1.0;
    pane.flexHeight = 1.0;
    pane.x = 0;
    pane.y = 0;
    pane.width = TUI_LAYOUT_FULL_WIDTH;
    pane.height = TUI_LAYOUT_DEFAULT_HEIGHT;
    pane.maximized = true;
    notify("Pane maximized", "info");
  }
}
