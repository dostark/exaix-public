import { createLayoutManager, type LayoutPane } from "../../src/tui/utils/layout_manager.ts";

export function setupLayoutManager(width = 80, height = 24) {
  return createLayoutManager(width, height);
}

export function createTestPane(overrides: Partial<LayoutPane> = {}): LayoutPane {
  return {
    id: "main",
    viewName: "PortalManagerView",
    x: 0,
    y: 0,
    width: 80,
    height: 24,
    focused: true,
    ...overrides,
  };
}

export function createPanes(count: number, width = 40, height = 24): LayoutPane[] {
  const panes: LayoutPane[] = [];
  const views = ["PortalManagerView", "MonitorView", "PlanReviewerView", "DaemonControlView"];

  for (let i = 0; i < count; i++) {
    panes.push({
      id: i === 0 ? "left" : "right",
      viewName: views[i % views.length],
      x: i * width,
      y: 0,
      width: width,
      height: height,
      focused: i === 0,
    });
  }
  return panes;
}
