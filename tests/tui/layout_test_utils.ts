import { type IPane, type ITuiView } from "../../src/tui/tui_dashboard.ts";

export function makePane(id: string, viewName: string, overrides: Partial<IPane> = {}): IPane {
  return {
    id,
    view: { name: viewName } as ITuiView,
    flexX: 0,
    flexY: 0,
    flexWidth: 1,
    flexHeight: 1,
    x: 0,
    y: 0,
    width: 1,
    height: 1,
    focused: true,
    maximized: false,
    ...overrides,
  };
}
