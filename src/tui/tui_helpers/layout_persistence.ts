import type { Pane } from "../tui_dashboard.ts";

export const getLayoutFile = () => `${Deno.env.get("HOME")}/.exoframe/tui_layout.json`;

export async function saveLayout(
  panes: Pane[],
  activePaneId: string,
  addNotification: (m: string, t?: string) => void,
) {
  try {
    await Deno.mkdir(`${Deno.env.get("HOME")}/.exoframe`, { recursive: true });
    const layout = {
      panes: panes.map((p) => ({
        id: p.id,
        viewName: p.view.name,
        x: p.x,
        y: p.y,
        width: p.width,
        height: p.height,
        focused: p.focused,
        maximized: p.maximized,
      })),
      activePaneId,
      version: "1.1",
    };
    await Deno.writeTextFile(getLayoutFile(), JSON.stringify(layout, null, 2));
    addNotification("Layout saved", "success");
  } catch (error) {
    addNotification(`Failed to save layout: ${error}`, "error");
  }
}

export async function restoreLayout(
  panes: Pane[],
  views: any[],
  addNotification: (m: string, t?: string) => void,
): Promise<{ activePaneId?: string } | null> {
  try {
    const content = await Deno.readTextFile(getLayoutFile());
    const layout = JSON.parse(content);
    if ((layout.version === "1.0" || layout.version === "1.1") && layout.panes) {
      panes.length = 0;
      for (const p of layout.panes) {
        const view = views.find((v: any) => v.name === p.viewName) || views[0];
        panes.push({
          id: p.id,
          view,
          x: p.x,
          y: p.y,
          width: p.width,
          height: p.height,
          focused: p.focused,
          maximized: p.maximized ?? false,
        });
      }
      const activePaneId = layout.activePaneId || panes[0]?.id || "main";
      addNotification("Layout restored", "success");
      return { activePaneId };
    }
  } catch (_error) {
    // If restore fails, keep default layout
    // noop
  }
  return null;
}

export function resetToDefault(panes: Pane[], views: any[], addNotification: (m: string, t?: string) => void): string {
  panes.length = 0;
  panes.push({
    id: "main",
    view: views[0],
    x: 0,
    y: 0,
    width: 80,
    height: 24,
    focused: true,
    maximized: false,
  });
  addNotification("Layout reset to default", "info");
  return "main";
}

export default { getLayoutFile, saveLayout, restoreLayout, resetToDefault };
