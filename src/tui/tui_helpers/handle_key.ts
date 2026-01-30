import type { Pane } from "../tui_dashboard.ts";
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
  KEY_F1,
  KEY_H,
  KEY_M,
  KEY_N,
  KEY_P,
  KEY_QUESTION,
  KEY_R,
  KEY_S,
  KEY_SHIFT_TAB,
  KEY_TAB,
  KEY_V,
  KEY_Z,
} from "../../config/constants.ts";

export async function testModeHandleKey(
  dashboard: any,
  key: string,
  panes: Pane[],
  views: any[],
  viewPickerRef: { index: number },
): Promise<number> {
  // Handle overlays and pickers via extracted helpers
  if (dashboard.state.showHelp) {
    return await (dashboard as any).handleHelpOverlay?.(dashboard, key, panes) ?? 0;
  }

  if (dashboard.state.showMemoryNotifications) {
    return await (dashboard as any).handleMemoryNotifications?.(dashboard, key, panes, dashboard.notificationService) ??
      0;
  }

  if (dashboard.state.showViewPicker) {
    const idx = (dashboard as any).handleViewPicker?.(dashboard, key, views, panes, viewPickerRef) ?? -1;
    return idx;
  }

  // Normal key handling
  if (key === KEY_QUESTION || key === KEY_F1) {
    dashboard.state.showHelp = true;
  } else if (key === KEY_P) {
    dashboard.state.showViewPicker = true;
    viewPickerRef.index = 0;
  } else if (key === KEY_N) {
    dashboard.state.showNotifications = !dashboard.state.showNotifications;
  } else if (key === KEY_M) {
    dashboard.state.showMemoryNotifications = !dashboard.state.showMemoryNotifications;
    dashboard.state.selectedMemoryNotifIndex = 0;
  } else if (key === KEY_TAB) {
    const currentIndex = panes.findIndex((p) => p.id === dashboard.activePaneId);
    const nextIndex = (currentIndex + 1) % panes.length;
    dashboard.activePaneId = panes[nextIndex].id;
    panes.forEach((p) => p.focused = false);
    panes[nextIndex].focused = true;
  } else if (key === KEY_SHIFT_TAB) {
    const currentIndex = panes.findIndex((p) => p.id === dashboard.activePaneId);
    const prevIndex = (currentIndex - 1 + panes.length) % panes.length;
    dashboard.activePaneId = panes[prevIndex].id;
    panes.forEach((p) => p.focused = false);
    panes[prevIndex].focused = true;
  } else if (key >= KEY_1 && key <= KEY_7) {
    // Direct pane navigation
    const idx = parseInt(key) - 1;
    if (idx < panes.length) {
      panes.forEach((p) => p.focused = false);
      panes[idx].focused = true;
      dashboard.activePaneId = panes[idx].id;
    }
  } else if (key === KEY_V) { // Split vertical
    await splitPane(panes, dashboard.activePaneId, views, "vertical", dashboard.notify.bind(dashboard));
  } else if (key === KEY_H) { // Split horizontal
    await splitPane(panes, dashboard.activePaneId, views, "horizontal", dashboard.notify.bind(dashboard));
  } else if (key === KEY_C) { // Close pane
    const result = await closePane(
      panes,
      dashboard.activePaneId,
      dashboard.activePaneId,
      dashboard.notify.bind(dashboard),
    );
    dashboard.activePaneId = result.activePaneId;
  } else if (key === KEY_Z) { // Maximize/restore
    maximizePane(panes, dashboard.activePaneId, dashboard.notify.bind(dashboard));
  } else if (key === KEY_CTRL_LEFT) {
    resizePane(panes, dashboard.activePaneId, -0.05, 0);
  } else if (key === KEY_CTRL_RIGHT) {
    resizePane(panes, dashboard.activePaneId, 0.05, 0);
  } else if (key === KEY_CTRL_UP) {
    resizePane(panes, dashboard.activePaneId, 0, -0.05);
  } else if (key === KEY_CTRL_DOWN) {
    resizePane(panes, dashboard.activePaneId, 0, 0.05);
  } else if (key === KEY_ENTER) { // Enter
    // No-op for test
  } else if (key === KEY_S) { // Save layout
    if (dashboard.saveLayout) await dashboard.saveLayout();
  } else if (key === KEY_R) { // Restore layout
    if (dashboard.restoreLayout) await dashboard.restoreLayout();
  } else if (key === KEY_D) { // Reset to default
    if (dashboard.resetToDefault) await dashboard.resetToDefault();
  }

  return panes.findIndex((p) => p.id === dashboard.activePaneId);
}
