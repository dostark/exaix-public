import process from "node:process";
import { type Pane } from "../../src/tui/tui_dashboard.ts";
import { noColorTheme } from "../../src/helpers/colors.ts";
import { prodRender } from "../../src/tui/dashboard/renderer.ts";
import { type INotificationService, type MemoryNotification } from "../../src/services/notification.ts";
import { type PortalDetails, type PortalInfo } from "../../src/cli/commands/portal_commands.ts";
import { type DashboardViewState } from "../../src/tui/tui_dashboard.ts";
import { type PortalService } from "../../src/tui/portal_manager_view.ts";

export type CapturedConsole = {
  logs: string[];
  clears: number;
};

export function captureConsole(): { captured: CapturedConsole; restore: () => void } {
  const captured: CapturedConsole = { logs: [], clears: 0 };

  const originalLog = console.log;
  const originalClear = console.clear;
  const originalDebug = console.debug;
  const originalError = console.error;

  console.log = (...args: string[]) => captured.logs.push(args.map(String).join(" "));
  console.clear = () => {
    captured.clears++;
  };
  console.debug = () => {};
  console.error = () => {};

  return {
    captured,
    restore: () => {
      console.log = originalLog;
      console.clear = originalClear;
      console.debug = originalDebug;
      console.error = originalError;
    },
  };
}

export function captureStdout(): { writes: string[]; restore: () => void } {
  const writes: string[] = [];
  const originalWrite = process.stdout.write.bind(process.stdout);

  (process.stdout as Partial<{ write: (chunk: string) => boolean }> as { write: (chunk: string) => boolean }).write = (
    chunk: string,
  ) => {
    writes.push(chunk);
    return true;
  };

  return {
    writes,
    restore: () => {
      (process.stdout as Partial<{ write: unknown }> as { write: unknown }).write = originalWrite;
    },
  };
}

import { makePane } from "./layout_test_utils.ts";
export { makePane };

export async function testProdRender(
  panes: Pane[],
  options: {
    showHelp?: boolean;
    showNotifications?: boolean;
    showMemoryNotifications?: boolean;
    notifications?: MemoryNotification[];
    portals?: PortalInfo[];
  } = {},
) {
  const { captured, restore } = captureConsole();
  const { writes, restore: restoreStdout } = captureStdout();
  try {
    await prodRender(
      panes,
      "main",
      {
        showHelp: options.showHelp ?? false,
        showNotifications: options.showNotifications ?? false,
        showMemoryNotifications: options.showMemoryNotifications ?? false,
        showViewPicker: false,
        isLoading: false,
        loadingMessage: "",
        error: null,
        currentTheme: "default",
        highContrast: false,
        screenReader: false,
        selectedMemoryNotifIndex: 0,
      } as DashboardViewState,
      noColorTheme,
      {
        getNotifications: () => Promise.resolve(options.notifications ?? []),
      } as Partial<INotificationService> as INotificationService,
      {
        listPortals: () => Promise.resolve(options.portals ?? []),
        getPortalDetails: () => Promise.resolve({} as Partial<PortalDetails> as PortalDetails),
        openPortal: () => Promise.resolve(true),
        closePortal: () => Promise.resolve(true),
        refreshPortal: () => Promise.resolve(true),
        removePortal: () => Promise.resolve(true),
        quickJumpToPortalDir: () => Promise.resolve(""),
        getPortalFilesystemPath: () => Promise.resolve(""),
        getPortalActivityLog: () => [],
      } as Partial<PortalService> as PortalService,
    );
    return { captured, writes };
  } finally {
    restoreStdout();
    restore();
  }
}
