import type { Pane } from "../tui_dashboard.ts";
import { closePane, maximizePane, resizePane, splitPane } from "../dashboard/pane_manager.ts";

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
  if (key === "?" || key === "f1") {
    dashboard.state.showHelp = true;
  } else if (key === "p") {
    dashboard.state.showViewPicker = true;
    viewPickerRef.index = 0;
  } else if (key === "n") {
    dashboard.state.showNotifications = !dashboard.state.showNotifications;
  } else if (key === "m") {
    dashboard.state.showMemoryNotifications = !dashboard.state.showMemoryNotifications;
    dashboard.state.selectedMemoryNotifIndex = 0;
  } else if (key === "tab") {
    const currentIndex = panes.findIndex((p) => p.id === dashboard.activePaneId);
    const nextIndex = (currentIndex + 1) % panes.length;
    dashboard.activePaneId = panes[nextIndex].id;
    panes.forEach((p) => p.focused = false);
    panes[nextIndex].focused = true;
  } else if (key === "shift+tab") {
    const currentIndex = panes.findIndex((p) => p.id === dashboard.activePaneId);
    const prevIndex = (currentIndex - 1 + panes.length) % panes.length;
    dashboard.activePaneId = panes[prevIndex].id;
    panes.forEach((p) => p.focused = false);
    panes[prevIndex].focused = true;
  } else if (key >= "1" && key <= "7") {
    // Direct pane navigation
    const idx = parseInt(key) - 1;
    if (idx < panes.length) {
      panes.forEach((p) => p.focused = false);
      panes[idx].focused = true;
      dashboard.activePaneId = panes[idx].id;
    }
  } else if (key === "v") { // Split vertical
    await splitPane(panes, dashboard.activePaneId, views, "vertical", dashboard.notify.bind(dashboard));
  } else if (key === "h") { // Split horizontal
    await splitPane(panes, dashboard.activePaneId, views, "horizontal", dashboard.notify.bind(dashboard));
  } else if (key === "c") { // Close pane
    const result = await closePane(
      panes,
      dashboard.activePaneId,
      dashboard.activePaneId,
      dashboard.notify.bind(dashboard),
    );
    dashboard.activePaneId = result.activePaneId;
  } else if (key === "z") { // Maximize/restore
    maximizePane(panes, dashboard.activePaneId, dashboard.notify.bind(dashboard));
  } else if (key === "ctrl+left") {
    resizePane(panes, dashboard.activePaneId, -0.05, 0);
  } else if (key === "ctrl+right") {
    resizePane(panes, dashboard.activePaneId, 0.05, 0);
  } else if (key === "ctrl+up") {
    resizePane(panes, dashboard.activePaneId, 0, -0.05);
  } else if (key === "ctrl+down") {
    resizePane(panes, dashboard.activePaneId, 0, 0.05);
  } else if (key === "enter") { // Enter
    // No-op for test
  } else if (key === "s") { // Save layout
    if (dashboard.saveLayout) await dashboard.saveLayout();
  } else if (key === "r") { // Restore layout
    if (dashboard.restoreLayout) await dashboard.restoreLayout();
  } else if (key === "d") { // Reset to default
    if (dashboard.resetToDefault) await dashboard.resetToDefault();
  }

  return panes.findIndex((p) => p.id === dashboard.activePaneId);
}
