/**
 * @module CommandUtilsTest
 * @path tests/helpers/command_utils_test.ts
 * @description Verifies internal CLI utilities, ensuring correct formatting of
 * validation errors and metadata presentation for system objects.
 */

import { assertEquals } from "@std/assert";
import { CommandUtils } from "../../src/helpers/command_utils.ts";
import { type ValidationResult } from "../../src/cli/base/command.ts";

Deno.test("CommandUtils.formatValidationErrors: formats required fields and minimums", () => {
  const result: ValidationResult = {
    isValid: false,
    errors: [
      "reason: is required",
      "comments: at least one comment is required",
      "title: cannot be empty",
      "raw message",
    ],
  };
  const out = CommandUtils.formatValidationErrors(result);

  assertEquals(
    out,
    [
      "Validation failed:",
      "- Rejection reason is required",
      "- At least one comment is required",
      "- Title cannot be empty",
      "- raw message",
    ].join("\n"),
  );
});

Deno.test("CommandUtils.printMetadata: prints only defined values", () => {
  const original = console.log;
  const lines: string[] = [];
  console.log = (...args: string[]) => {
    lines.push(args.map(String).join(" "));
  };

  try {
    CommandUtils.printMetadata("Title", { a: 1, b: undefined, c: null, d: "x" });

    // Includes title, underline, defined keys, and trailing blank line
    assertEquals(lines.includes("a                   : 1"), true);
    assertEquals(lines.includes("d                   : x"), true);
    assertEquals(lines.some((l) => l.includes("b")), false);
    assertEquals(lines.some((l) => l.includes("c")), false);
  } finally {
    console.log = original;
  }
});
