import { lintMarkdown } from "../../scripts/markdown_lint.ts";

/**
 * Regression tests for MD060/table-column-style.
 *
 * Bug: The custom linter previously computed an "expected" aligned table layout
 * from cell content widths and treated a broad Unicode range as double-width.
 * That diverged from markdownlint behavior and caused false positives for valid
 * aligned tables (notably ones containing symbols like "✓" and inline code).
 *
 * Fix: Detect table style (aligned/compact/tight) per table, and for aligned
 * style compare pipe positions using visual width with emoji handling.
 */

type Options = { fix: boolean; strict: boolean; verbose: boolean };

const defaultOptions: Options = { fix: false, strict: false, verbose: false };

Deno.test("[regression] MD060 accepts aligned table with checkmarks", () => {
  const md = [
    "| Field      | Required | Example |",
    "| ---------- | -------- | ------- |",
    "| trace_id   | ✓        | `abc`   |",
    "| created_by |          | `x@y`   |",
    "",
  ].join("\n");

  const findings = lintMarkdown(md, "inline.md", defaultOptions);
  const md060 = findings.filter((f) => f.rule === "MD060/table-column-style");
  if (md060.length !== 0) {
    throw new Error(`expected 0 MD060 findings, got ${md060.length}`);
  }
});

Deno.test("[regression] MD060 reports misaligned aligned-style table", () => {
  const md = [
    "| Field      | Required | Example |",
    "| ---------- | -------- | ------- |",
    "| trace_id   | ✓       | `abc`   |", // one fewer space: misalign the pipe
    "| created_by |         | `x@y`   |",
    "",
  ].join("\n");

  const findings = lintMarkdown(md, "inline.md", defaultOptions);
  const md060 = findings.filter((f) => f.rule === "MD060/table-column-style");
  if (md060.length === 0) {
    throw new Error("expected at least one MD060 finding");
  }
});
