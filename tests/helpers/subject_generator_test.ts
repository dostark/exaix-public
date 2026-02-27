/**
 * @module SubjectGeneratorTest
 * @path tests/helpers/subject_generator_test.ts
 * @description Unit tests for subject generation and validation utilities.
 */

import { assertEquals } from "@std/assert";
import { extractFallbackSubject, resolveSubject, validateSubject } from "../../src/helpers/subject_generator.ts";

Deno.test("subject_generator - extractFallbackSubject", () => {
  assertEquals(extractFallbackSubject("Short description"), "Short description");
  assertEquals(extractFallbackSubject("# Markdown Title"), "Markdown Title");
  assertEquals(extractFallbackSubject("- List item"), "List item");
  assertEquals(extractFallbackSubject("  First line\nSecond line"), "First line");
  assertEquals(extractFallbackSubject(""), "");

  const longText =
    "This is a very long description that should be truncated at some point because it exceeds the maximum allowed length for a subject line in our entity system";
  const truncated = extractFallbackSubject(longText, 60);
  assertEquals(truncated.endsWith("…"), true);
  assertEquals(truncated.length <= 61, true); // 60 + …
  assertEquals(truncated, "This is a very long description that should be truncated at…");
});

Deno.test("subject_generator - validateSubject", () => {
  assertEquals(validateSubject("Valid Subject"), "Valid Subject");
  assertEquals(validateSubject("  Trimmed Subject  "), "Trimmed Subject");
  assertEquals(validateSubject(""), null);
  assertEquals(validateSubject("Subject with\nnewline"), null);
  assertEquals(validateSubject("A".repeat(81)), null);
  assertEquals(validateSubject(null), null);
  assertEquals(validateSubject(123), null);
});

Deno.test("subject_generator - resolveSubject", () => {
  const description = "Feature description";

  // 1. Explicit takes precedence
  assertEquals(
    resolveSubject({ explicit: "Explicit", agentSubject: "Agent", description }),
    "Explicit",
  );

  // 2. Agent wins over fallback
  assertEquals(
    resolveSubject({ agentSubject: "Agent", description }),
    "Agent",
  );

  // 3. Fallback if others missing or invalid
  assertEquals(
    resolveSubject({ agentSubject: "Invalid\nAgent", description }),
    "Feature description",
  );

  assertEquals(
    resolveSubject({ description }),
    "Feature description",
  );
});
