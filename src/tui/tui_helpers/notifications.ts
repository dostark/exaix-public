/**
 * @module TuiNotificationsHelper
 * @path src/tui/tui_helpers/notifications.ts
 * @description Helper functions for rendering and managing TUI notifications, including time formatting and interaction logic.
 * @architectural-layer TUI
 * @dependencies [keyboard, colors]
 * @related-files [src/services/notification.ts, src/tui/tui_dashboard.ts]
 */

import { KEYS } from "../../helpers/keyboard.ts";
import { colorize, type TuiTheme } from "../../helpers/colors.ts";
import type { DashboardViewState, Pane } from "../tui_dashboard.ts";
import type { MemoryNotification, NotificationService } from "../../services/notification.ts";

interface TuiNotification extends MemoryNotification {
  icon?: string;
}

export interface DashboardContext {
  state: DashboardViewState;
  activePaneId: string;
  approveMemoryUpdate: (id: string) => Promise<void>;
  rejectMemoryUpdate: (id: string) => Promise<void>;
}

export function formatTimeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);

  if (seconds < 60) return "just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

export async function renderNotificationPanel(
  notificationService: NotificationService,
  theme: TuiTheme,
  state: DashboardViewState,
  maxHeight = 10,
): Promise<string[]> {
  const lines: string[] = [];
  let activeNotifications = await notificationService.getNotifications() as TuiNotification[];

  const messageColorByType: Record<string, string> = {
    error: theme.error,
    memory_rejected: theme.error,
    warning: theme.warning,
    success: theme.success,
    memory_approved: theme.success,
    info: theme.primary,
    memory_update_pending: theme.primary,
  };

  if (state.showMemoryNotifications) {
    activeNotifications = activeNotifications.filter((n) => n.type === "memory_update_pending");
  }

  if (activeNotifications.length === 0) {
    lines.push(colorize("  No notifications", theme.textDim, theme.reset));
    return lines;
  }

  const title = state.showMemoryNotifications ? "Pending Memory Updates" : "Notifications";
  lines.push(
    colorize(`🔔 ${title} (${activeNotifications.length})`, theme.h2, theme.reset),
  );
  lines.push("");

  const visibleNotifications = activeNotifications.slice(0, maxHeight - 2);

  for (let i = 0; i < visibleNotifications.length; i++) {
    const notification = visibleNotifications[i];
    const type = notification.type;
    const icon = notification.icon || "ℹ️";
    const timestamp = notification.created_at ? new Date(notification.created_at) : new Date();
    const timeAgo = formatTimeAgo(timestamp);

    const isSelected = state.showMemoryNotifications && i === state.selectedMemoryNotifIndex;

    const messageColor = messageColorByType[String(type)] ?? theme.text;

    const prefix = isSelected ? "▶ " : "  ";
    let line = `${prefix}${icon} ${colorize(notification.message, messageColor, theme.reset)} ${
      colorize(`(${timeAgo})`, theme.textDim, theme.reset)
    }`;

    if (isSelected) {
      line = colorize(line, theme.primary, theme.reset);
    }
    lines.push(line);
  }

  if (activeNotifications.length > visibleNotifications.length) {
    const more = activeNotifications.length - visibleNotifications.length;
    lines.push(colorize(`  ... and ${more} more`, theme.textDim, theme.reset));
  }

  return lines;
}

export async function handleMemoryNotifications(
  self: DashboardContext,
  key: string,
  panes: Pane[],
  notificationService: NotificationService,
) {
  if (key === KEYS.ESCAPE || key === KEYS.M) {
    self.state.showMemoryNotifications = false;
  } else {
    const allNotifs = await notificationService.getNotifications();
    const memoryNotifs = allNotifs.filter((n) => n.type === "memory_update_pending");
    const count = memoryNotifs.length;

    if (key === "up" || key === "k") {
      if (count > 0) {
        self.state.selectedMemoryNotifIndex = (self.state.selectedMemoryNotifIndex - 1 + count) % count;
      }
    } else if (key === "down" || key === "j") {
      if (count > 0) {
        self.state.selectedMemoryNotifIndex = (self.state.selectedMemoryNotifIndex + 1) % count;
      }
    } else if (key === "a" && count > 0) {
      if (self.state.selectedMemoryNotifIndex < count) {
        const selected = memoryNotifs[self.state.selectedMemoryNotifIndex];
        await self.approveMemoryUpdate((selected.proposal_id || selected.id) as string);
      }
    } else if (key === "r" && count > 0) {
      if (self.state.selectedMemoryNotifIndex < count) {
        const selected = memoryNotifs[self.state.selectedMemoryNotifIndex];
        await self.rejectMemoryUpdate((selected.proposal_id || selected.id) as string);
      }
    }
  }

  return panes.findIndex((p) => p.id === self.activePaneId);
}
