/**
 * Renderer for TUI Dashboard
 * Extracted from tui_dashboard.ts to reduce complexity
 */

import process from "node:process";
import { type TuiTheme as Theme } from "../utils/colors.ts";
import { TUI_MSG_DASHBOARD_HEADER, TUI_MSG_PRESS_CLOSE_HELP, TUI_STATUS_MSG_READY } from "../../config/constants.ts";
import { type Pane, renderGlobalHelpOverlay, renderPaneTitleBar, renderViewIndicator } from "../tui_dashboard.ts";
import { renderNotificationPanel } from "../tui_helpers/notifications.ts";
import type { NotificationService } from "../../services/notification.ts";
import type { DashboardViewState } from "../tui_dashboard.ts";
import { Table } from "https://deno.land/x/cliffy@v0.25.7/mod.ts";

/**
 * Production render function for the dashboard
 */
export async function prodRender(
  panes: Pane[],
  activePaneId: string,
  state: DashboardViewState,
  theme: Theme,
  notificationService: NotificationService,
  portalView: any,
): Promise<void> {
  console.clear();

  // Header with view indicators
  console.log("╔══════════════════════════════════════════════════════════════════════════════╗");
  console.log(`║${TUI_MSG_DASHBOARD_HEADER}║`);
  console.log("╠══════════════════════════════════════════════════════════════════════════════╣");

  // View indicators
  const viewIndicator = renderViewIndicator(panes, activePaneId, theme);
  console.log(`║ ${viewIndicator.padEnd(76)} ║`);
  console.log("╠══════════════════════════════════════════════════════════════════════════════╣");

  // Help overlay
  if (state.showHelp) {
    const helpLines = renderGlobalHelpOverlay(theme);
    for (const line of helpLines) {
      console.log(line);
    }
    console.log(TUI_MSG_PRESS_CLOSE_HELP);
    return;
  }

  // Notification panel
  if (state.showNotifications || state.showMemoryNotifications) {
    const notifLines = await renderNotificationPanel(notificationService, theme, state);
    for (const line of notifLines) {
      console.log(line);
    }
    const closeKey = state.showMemoryNotifications ? "m" : "n";
    process.stdout.write(`\nPress ${closeKey} to close`);
    if (state.showMemoryNotifications) {
      process.stdout.write(" | a: Approve | r: Reject | Up/Down: Navigate\n");
    } else {
      process.stdout.write("\n");
    }
    return;
  }

  // Main content
  const activePane = panes.find((p) => p.id === activePaneId);
  if (activePane?.view.name === "PortalManagerView") {
    const portals = await portalView.service.listPortals();

    if (portals.length > 0) {
      const table = new Table();
      table.header(["Alias", "Target Path", "Status", "Permissions"]);
      for (const p of portals) {
        table.push([p.alias, p.targetPath, p.status, p.permissions]);
      }
      table.render();
    } else {
      console.log("No portals configured.");
    }
  } else {
    const titleBar = renderPaneTitleBar(activePane!, theme);
    console.log(titleBar);
    console.log("");
    console.log(`Viewing: ${activePane?.view.name}`);
    // TODO: Render other views
  }

  // Status bar
  console.log("");
  console.log("╠══════════════════════════════════════════════════════════════════════════════╣");

  // Show active notifications count
  const allNotifs = await notificationService.getNotifications();
  const activeNotifs = allNotifs.filter((n: any) => !n.dismissed_at);
  const notifBadge = activeNotifs.length > 0 ? ` 🔔 ${activeNotifs.length}` : "";

  console.log(`║ Status: ${TUI_STATUS_MSG_READY}${notifBadge.padEnd(64)}║`);
  console.log("╠══════════════════════════════════════════════════════════════════════════════╣");
  console.log("║ Navigation: Tab/Shift+Tab | Split: v/h | Close: c | Maximize: z | Help: ?   ║");
  console.log("║ Layout: s=save, r=restore, d=default | n=notifications | p=view picker      ║");
  console.log("║ Exit: Esc                                                                    ║");
  console.log("╚══════════════════════════════════════════════════════════════════════════════╝");
}
