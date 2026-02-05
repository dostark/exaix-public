import { lintMarkdown } from "../../scripts/markdown_lint.ts";

/**
 * Regression tests for MD029/ol-prefix output volume.
 *
 * Behavior change: Reduce noise by reporting at most one MD029 finding per
 * ordered-list block (per indentation level).
 */

type Options = { fix: boolean; strict: boolean; verbose: boolean };

const defaultOptions: Options = { fix: false, strict: false, verbose: false };

Deno.test("[regression] MD029 reports once per ordered-list block", () => {
  const md = [
    "Intro paragraph.",
    "",
    "1. First item",
    "2. Second item",
    "3. Third item",
    "",
  ].join("\n");

  const findings = lintMarkdown(md, "inline.md", defaultOptions as any);
  const md029 = findings.filter((f) => f.rule === "MD029/ol-prefix");
  if (md029.length !== 1) {
    throw new Error(`expected 1 MD029 finding, got ${md029.length}`);
  }
});

Deno.test("[regression] MD029 reports again for a new block", () => {
  const md = [
    "Intro paragraph.",
    "",
    "1. First item",
    "2. Second item",
    "",
    "Between lists.",
    "",
    "1. Another list",
    "2. Second item",
    "",
  ].join("\n");

  const findings = lintMarkdown(md, "inline.md", defaultOptions as any);
  const md029 = findings.filter((f) => f.rule === "MD029/ol-prefix");
  if (md029.length !== 2) {
    throw new Error(`expected 2 MD029 findings, got ${md029.length}`);
  }
});
