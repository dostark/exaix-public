import { assertEquals } from "@std/assert";
import { detectErrorPatterns } from "../../src/tui/analytics/error_analyzer.ts";
import type { LogEntry } from "../../src/services/structured_logger.ts";

function entry(overrides: Partial<LogEntry>): LogEntry {
  return {
    timestamp: overrides.timestamp ?? new Date(0).toISOString(),
    level: overrides.level ?? "error",
    message: overrides.message ?? "m",
    context: overrides.context ?? {},
    error: overrides.error,
  } as LogEntry;
}

Deno.test("detectErrorPatterns: groups errors by message and sorts by count", () => {
  const entries: LogEntry[] = [
    entry({
      timestamp: new Date(1).toISOString(),
      level: "error",
      message: "fallback",
      context: { operation: "op1" },
      error: { name: "E", message: "boom" },
    }),
    entry({
      timestamp: new Date(2).toISOString(),
      level: "fatal",
      message: "fallback",
      context: { operation: "op2" },
      error: { name: "E", message: "boom" },
    }),
    entry({
      timestamp: new Date(3).toISOString(),
      level: "error",
      message: "other",
      context: {},
    }),
  ];

  const patterns = detectErrorPatterns(entries);

  assertEquals(patterns.length, 2);
  assertEquals(patterns[0].pattern, "boom");
  assertEquals(patterns[0].count, 2);
  assertEquals(patterns[0].affectedOperations.sort(), ["op1", "op2"]);
  assertEquals(patterns[1].pattern, "other");
  assertEquals(patterns[1].affectedOperations, ["unknown"]);
});
