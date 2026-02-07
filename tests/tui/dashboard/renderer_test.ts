import { assertEquals, assertExists } from "@std/assert";

import process from "node:process";
import { noColorTheme } from "../../../src/helpers/colors.ts";
import { prodRender } from "../../../src/tui/dashboard/renderer.ts";
import type { Pane } from "../../../src/tui/tui_dashboard.ts";

type CapturedConsole = {
  logs: string[];
  clears: number;
};

function captureConsole(): { captured: CapturedConsole; restore: () => void } {
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

function captureStdout(): { writes: string[]; restore: () => void } {
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

function makePane(id: string, viewName: string, overrides: Partial<Pane> = {}): Pane {
  return {
    id,
    view: { name: viewName } as any,
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
    ...(overrides as any),
  } as Pane;
}

Deno.test("prodRender: falls back to 80x24 when consoleSize throws", async () => {
  const originalConsoleSize = (Deno as any).consoleSize;
  (Deno as any).consoleSize = () => {
    throw new Error("no tty");
  };

  const { captured, restore } = captureConsole();
  try {
    const panes: Pane[] = [makePane("main", "AnyView", { flexX: 0.5, flexY: 0.25, flexWidth: 0.5, flexHeight: 0.5 })];

    await prodRender(
      panes,
      "main",
      { showHelp: false, showNotifications: false, showMemoryNotifications: false } as any,
      noColorTheme,
      { getNotifications: () => Promise.resolve([]) } as any,
      { service: { listPortals: () => Promise.resolve([]) } } as any,
    );

    // header border implies we rendered something
    assertEquals(captured.clears, 1);
    assertExists(captured.logs.find((l) => l.includes("╔")));

    // Pane coords should be updated based on fallback size
    assertEquals(panes[0].width, Math.floor(0.5 * 80));
  } finally {
    restore();
    (Deno as any).consoleSize = originalConsoleSize;
  }
});

Deno.test("prodRender: renders help overlay and returns early", async () => {
  const { captured, restore } = captureConsole();

  try {
    const panes: Pane[] = [makePane("main", "AnyView")];

    await prodRender(
      panes,
      "main",
      { showHelp: true, showNotifications: false, showMemoryNotifications: false } as any,
      noColorTheme,
      { getNotifications: () => Promise.resolve([]) } as any,
      { service: { listPortals: () => Promise.resolve([]) } } as any,
    );

    assertExists(captured.logs.find((l) => l.includes("Press") || l.includes("close")));
  } finally {
    restore();
  }
});

Deno.test("prodRender: renders notification panel and writes close hint", async () => {
  const { captured, restore } = captureConsole();
  const { writes, restore: restoreStdout } = captureStdout();

  try {
    const panes: Pane[] = [makePane("main", "AnyView")];

    await prodRender(
      panes,
      "main",
      { showHelp: false, showNotifications: true, showMemoryNotifications: false } as any,
      noColorTheme,
      {
        getNotifications: () =>
          Promise.resolve([
            {
              id: "n1",
              type: "info",
              message: "hello",
              dismissed_at: null,
              created_at: new Date().toISOString(),
            },
          ]),
      } as any,
      { service: { listPortals: () => Promise.resolve([]) } } as any,
    );

    // Panel lines are rendered via console.log; close hint via stdout.write.

    assertExists(
      captured.logs.find((l) => l.includes("Notifications") || l.includes("No notifications") || l.includes("🔔")),
    );
    assertEquals(writes.length > 0, true);
  } finally {
    restoreStdout();
    restore();
  }
});

Deno.test("prodRender: PortalManagerView prints empty state", async () => {
  const { captured, restore } = captureConsole();

  try {
    const panes: Pane[] = [makePane("main", "PortalManagerView")];

    await prodRender(
      panes,
      "main",
      { showHelp: false, showNotifications: false, showMemoryNotifications: false } as any,
      noColorTheme,
      { getNotifications: () => Promise.resolve([]) } as any,
      { service: { listPortals: () => Promise.resolve([]) } } as any,
    );

    assertExists(captured.logs.find((l) => l.includes("No portals configured.")));
  } finally {
    restore();
  }
});
