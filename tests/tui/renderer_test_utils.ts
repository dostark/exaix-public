import process from "node:process";
import { Pane } from "../../src/tui/tui_dashboard.ts";
import { noColorTheme } from "../../src/helpers/colors.ts";
import { prodRender } from "../../src/tui/dashboard/renderer.ts";

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

  console.log = (...args: unknown[]) => captured.logs.push(args.map(String).join(" "));
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

  (process.stdout as any).write = (chunk: unknown) => {
    writes.push(String(chunk));
    return true;
  };

  return {
    writes,
    restore: () => {
      (process.stdout as any).write = originalWrite;
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
    notifications?: any[];
    portals?: any[];
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
      } as any,
      noColorTheme,
      { getNotifications: () => Promise.resolve(options.notifications ?? []) } as any,
      { listPortals: () => Promise.resolve(options.portals ?? []) } as any,
    );
    return { captured, writes };
  } finally {
    restoreStdout();
    restore();
  }
}
