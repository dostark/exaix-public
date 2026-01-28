import type { Pane } from "../tui_dashboard.ts";

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
    const activePane = panes.find((p) => p.id === dashboard.activePaneId);
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
      await dashboard.notify("Pane split vertically", "info");
    }
  } else if (key === "h") { // Split horizontal
    const activePane = panes.find((p) => p.id === dashboard.activePaneId);
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
      await dashboard.notify("Pane split horizontally", "info");
    }
  } else if (key === "c") { // Close pane
    if (panes.length > 1) {
      const index = panes.findIndex((p) => p.id === dashboard.activePaneId);
      panes.splice(index, 1);
      dashboard.activePaneId = panes[0].id;
      panes[0].focused = true;
      await dashboard.notify("Pane closed", "info");
    }
  } else if (key === "z") { // Maximize/restore
    dashboard.maximizePane(dashboard.activePaneId);
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
