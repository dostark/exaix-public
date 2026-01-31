/**
 * TUI Keyboard Utility Tests
 *
 * Part of Phase 13.1: Shared TUI Infrastructure
 */

import { assertEquals, assertStringIncludes } from "@std/assert";
import {
  createNavigationHandlers,
  formatKey,
  generateHelpScreen,
  type KeyBinding,
  KeyboardManager,
  KEYS,
  type KeyValue,
  matchesKey,
  parseKey,
} from "../../../src/tui/utils/keyboard.ts";

// ===== Key Constants Tests =====

Deno.test("KEYS: has navigation keys", () => {
  assertEquals(KEYS.UP, "up");
  assertEquals(KEYS.DOWN, "down");
  assertEquals(KEYS.LEFT, "left");
  assertEquals(KEYS.RIGHT, "right");
});

Deno.test("KEYS: has action keys", () => {
  assertEquals(KEYS.ENTER, "enter");
  assertEquals(KEYS.ESCAPE, "escape");
  assertEquals(KEYS.TAB, "tab");
});

// ===== Parse Key Tests =====

Deno.test("parseKey: parses simple key", () => {
  const event = parseKey("a");
  assertEquals(event.key, "a");
  assertEquals(event.modifiers.size, 0);
});

Deno.test("parseKey: parses ctrl+ modifier", () => {
  const event = parseKey("ctrl+c");
  assertEquals(event.key, "c");
  assertEquals(event.modifiers.has("ctrl"), true);
});

Deno.test("parseKey: parses alt+ modifier", () => {
  const event = parseKey("alt+x");
  assertEquals(event.key, "x");
  assertEquals(event.modifiers.has("alt"), true);
});

Deno.test("parseKey: parses shift+ modifier", () => {
  const event = parseKey("shift+tab");
  assertEquals(event.key, "tab");
  assertEquals(event.modifiers.has("shift"), true);
});

Deno.test("parseKey: normalizes to lowercase", () => {
  const event = parseKey("Ctrl+C");
  assertEquals(event.key, "c");
  assertEquals(event.modifiers.has("ctrl"), true);
});

// ===== Format Key Tests =====

Deno.test("formatKey: formats simple key", () => {
  const result = formatKey("a");
  assertEquals(result, "A");
});

Deno.test("formatKey: formats special keys", () => {
  const result = formatKey("enter");
  assertEquals(result, "Enter");
});

Deno.test("formatKey: formats with modifiers", () => {
  const result = formatKey("c", ["ctrl"]);
  assertEquals(result, "Ctrl+C");
});

Deno.test("formatKey: formats multiple modifiers", () => {
  const result = formatKey("s", ["ctrl", "shift"]);
  assertEquals(result, "Ctrl+Shift+S");
});

// ===== Match Key Tests =====

Deno.test("matchesKey: matches simple key", () => {
  assertEquals(matchesKey("a", "a"), true);
  assertEquals(matchesKey("a", "b"), false);
});

Deno.test("matchesKey: matches with modifiers", () => {
  assertEquals(matchesKey("ctrl+c", "ctrl+c"), true);
  assertEquals(matchesKey("ctrl+c", "c"), false);
});

Deno.test("matchesKey: is case insensitive", () => {
  assertEquals(matchesKey("Ctrl+C", "ctrl+c"), true);
});

// ===== Keyboard Manager Tests =====

// Helper for KeyboardManager tests
function setupManager<T extends string>(action: T = "test" as T, key: KeyValue = "x") {
  const manager = new KeyboardManager<T>();
  manager.bind({ key, action, description: "Test Action" });
  return manager;
}

Deno.test("KeyboardManager: binds and retrieves bindings", () => {
  const manager = setupManager<"save">("save", "ctrl+s");
  const bindings = manager.getBindings();
  assertEquals(bindings.length, 1);
  assertEquals(bindings[0].action, "save");
});

Deno.test("KeyboardManager: bindAll adds multiple bindings", () => {
  const manager = new KeyboardManager<"a" | "b">();
  manager.bindAll([
    { key: "a", action: "a", description: "Action A" },
    { key: "b", action: "b", description: "Action B" },
  ]);
  assertEquals(manager.getBindings().length, 2);
});

Deno.test("KeyboardManager: hasBinding checks existence", () => {
  const manager = setupManager();
  assertEquals(manager.hasBinding("x"), true);
  assertEquals(manager.hasBinding("y"), false);
});

Deno.test("KeyboardManager: handle calls handler", async () => {
  const manager = setupManager();
  let called = false;

  manager.on("test", () => {
    called = true;
    return true;
  });

  const handled = await manager.handle("x");
  assertEquals(handled, true);
  assertEquals(called, true);
});

Deno.test("KeyboardManager: handle returns false for unbound key", async () => {
  const manager = new KeyboardManager<"test">();
  const handled = await manager.handle("x");
  assertEquals(handled, false);
});

Deno.test("KeyboardManager: disable prevents handling", async () => {
  const manager = setupManager();
  let called = false;

  manager.on("test", () => {
    called = true;
    return true;
  });

  manager.disable();
  await manager.handle("x");
  assertEquals(called, false);
  assertEquals(manager.isEnabled(), false);
});

Deno.test("KeyboardManager: enable re-enables handling", async () => {
  const manager = setupManager();
  let called = false;

  manager.on("test", () => {
    called = true;
    return true;
  });

  manager.disable();
  manager.enable();
  await manager.handle("x");
  assertEquals(called, true);
});

Deno.test("KeyboardManager: getBindingsByCategory groups bindings", () => {
  const manager = new KeyboardManager<"a" | "b" | "c">();

  manager.bindAll([
    { key: "a", action: "a", description: "A", category: "General" },
    { key: "b", action: "b", description: "B", category: "General" },
    { key: "c", action: "c", description: "C", category: "Actions" },
  ]);

  const groups = manager.getBindingsByCategory();
  assertEquals(groups.get("General")?.length, 2);
  assertEquals(groups.get("Actions")?.length, 1);
});

// ===== Navigation Handlers Tests =====

// Helper for navigation tests
function setupNavHandlers(initialIndex = 0, length = 10) {
  let index = initialIndex;
  const setIndex = (i: number) => {
    index = i;
  };
  const handlers = createNavigationHandlers(
    () => ({ selectedIndex: index, length }),
    setIndex,
  );
  return {
    handlers,
    getIndex: () => index,
    setIndex,
  };
}

Deno.test("createNavigationHandlers: up decrements index", () => {
  const { handlers, getIndex } = setupNavHandlers(5);
  handlers.up("up");
  assertEquals(getIndex(), 4);
});

Deno.test("createNavigationHandlers: down increments index", () => {
  const { handlers, getIndex } = setupNavHandlers(5);
  handlers.down("down");
  assertEquals(getIndex(), 6);
});

Deno.test("createNavigationHandlers: home goes to start", () => {
  const { handlers, getIndex } = setupNavHandlers(5);
  handlers.home("home");
  assertEquals(getIndex(), 0);
});

Deno.test("createNavigationHandlers: end goes to end", () => {
  const { handlers, getIndex } = setupNavHandlers(5);
  handlers.end("end");
  assertEquals(getIndex(), 9);
});

Deno.test("createNavigationHandlers: respects bounds", () => {
  const ctx = setupNavHandlers(0);

  ctx.handlers.up("up"); // Should not go below 0
  assertEquals(ctx.getIndex(), 0);

  ctx.setIndex(9);
  ctx.handlers.down("down"); // Should not go above length - 1
  assertEquals(ctx.getIndex(), 9);
});

// ===== Generate Help Screen Tests =====

Deno.test("generateHelpScreen: generates help with title", () => {
  const bindings: KeyBinding<string>[] = [
    { key: "q", action: "quit", description: "Quit application" },
  ];

  const lines = generateHelpScreen(bindings, { useColors: false });
  const text = lines.join("\n");

  assertStringIncludes(text, "Keyboard Shortcuts");
  assertStringIncludes(text, "Q");
  assertStringIncludes(text, "Quit application");
});

Deno.test("generateHelpScreen: groups by category", () => {
  const bindings: KeyBinding<string>[] = [
    { key: "a", action: "a", description: "A", category: "Navigation" },
    { key: "b", action: "b", description: "B", category: "Actions" },
  ];

  const lines = generateHelpScreen(bindings, { useColors: false });
  const text = lines.join("\n");

  assertStringIncludes(text, "Navigation");
  assertStringIncludes(text, "Actions");
});

Deno.test("generateHelpScreen: uses custom title", () => {
  const bindings: KeyBinding<string>[] = [];
  const lines = generateHelpScreen(bindings, {
    title: "Custom Help",
    useColors: false,
  });

  assertStringIncludes(lines[0], "Custom Help");
});
