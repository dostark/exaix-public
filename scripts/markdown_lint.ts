/**
 * Markdown Lint
 *
 * A lightweight markdown linter used by dev-time agents and repo tooling.
 *
 * Default behavior is READ-ONLY (no writes), so it can run with `--allow-read`.
 *
 * Usage:
 *   deno run --allow-read scripts/markdown_lint.ts
 *   deno run --allow-read scripts/markdown_lint.ts docs/some.md .copilot/
 *   deno run --allow-read --allow-write scripts/markdown_lint.ts --fix
 */

import { walk } from "@std/fs";
import { extname, join, normalize } from "@std/path";

type Severity = "error" | "warn";

interface Finding {
  filePath: string;
  line: number; // 1-based
  rule: string;
  severity: Severity;
  message: string;
}

interface LintOptions {
  fix: boolean;
  strict: boolean;
  verbose: boolean;
}

const DEFAULT_ROOTS: readonly string[] = [
  "docs",
  ".copilot",
  "Blueprints",
  ".claude",
  ".cursor",
  ".ai",
  ".anthropic",
  "README.md",
  "CONTRIBUTING.md",
  "CLAUDE.md",
];

const SKIP_DIRS = new Set([
  ".git",
  "node_modules",
  "dist",
  "coverage",
  "cov_profile",
  "Workspace",
  "Memory",
  "logs",
]);

function parseArgs(args: string[]): { options: LintOptions; paths: string[] } {
  const options: LintOptions = { fix: false, strict: false, verbose: false };
  const paths: string[] = [];

  for (const arg of args) {
    if (arg === "--fix") options.fix = true;
    else if (arg === "--strict") options.strict = true;
    else if (arg === "--verbose" || arg === "-v") options.verbose = true;
    else if (arg === "--help" || arg === "-h") {
      printHelp();
      Deno.exit(0);
    } else {
      paths.push(arg);
    }
  }

  return { options, paths };
}

function printHelp(): void {
  console.log(
    `Markdown lint\n\nUsage:\n  deno run --allow-read scripts/markdown_lint.ts [paths...]\n\nOptions:\n  --fix       Apply safe auto-fixes (requires --allow-write)\n  --strict    Treat warnings as errors\n  --verbose   Print file-level progress\n  --help      Show help\n\nIf no paths are provided, defaults to: ${
      DEFAULT_ROOTS.join(", ")
    }`,
  );
}

function isMarkdownFile(path: string): boolean {
  return extname(path).toLowerCase() === ".md";
}

async function pathExists(path: string): Promise<boolean> {
  try {
    await Deno.stat(path);
    return true;
  } catch {
    return false;
  }
}

async function collectMarkdownFiles(inputPaths: string[]): Promise<string[]> {
  const files: string[] = [];
  const roots = inputPaths.length > 0 ? inputPaths : [...DEFAULT_ROOTS];

  for (const raw of roots) {
    const p = normalize(raw);
    if (!(await pathExists(p))) continue;

    const stat = await Deno.stat(p);
    if (stat.isFile) {
      if (isMarkdownFile(p)) files.push(p);
      continue;
    }

    for await (
      const entry of walk(p, {
        includeDirs: false,
        followSymlinks: false,
        exts: ["md"],
        skip: [
          // Skip hidden dirs and known large dirs.
          new RegExp(`${join(p, "\\.git")}`),
        ],
      })
    ) {
      const parts = entry.path.split("/");
      if (parts.some((seg) => SKIP_DIRS.has(seg))) continue;
      files.push(entry.path);
    }
  }

  // De-dup + stable sort
  return Array.from(new Set(files)).sort();
}

function splitLines(text: string): string[] {
  return text.split("\n");
}

type Fence = { char: "`" | "~"; length: number };

function parseFenceStart(line: string): Fence | null {
  const trimmed = line.trimStart();
  const match = /^(?<ticks>`{3,})|^(?<tildes>~{3,})/.exec(trimmed);
  if (!match) return null;

  const ticks = match.groups?.ticks;
  if (ticks) return { char: "`", length: ticks.length };

  const tildes = match.groups?.tildes;
  if (tildes) return { char: "~", length: tildes.length };

  return null;
}

function isFenceClose(line: string, fence: Fence): boolean {
  const trimmed = line.trimStart();
  const closeMatch = new RegExp(`^${fence.char}{${fence.length},}(?:\\s*)$`).exec(
    trimmed,
  );
  return closeMatch !== null;
}

function applySafeFixes(original: string): { fixed: string; changed: boolean } {
  // Normalize newlines first.
  let text = original.replaceAll("\r\n", "\n").replaceAll("\r", "\n");

  const lines = splitLines(text);
  const out: string[] = [];

  let inFence = false;
  let fence: Fence | null = null;
  let blankRun = 0;

  for (const line of lines) {
    const fenceStart = parseFenceStart(line);
    if (fenceStart) {
      if (!inFence) {
        inFence = true;
        fence = fenceStart;
      } else if (fence && isFenceClose(line, fence)) {
        inFence = false;
        fence = null;
      }

      // Preserve fence lines (after trimming trailing whitespace).
      out.push(line.replace(/[ \t]+$/g, ""));
      blankRun = 0;
      continue;
    }

    const trimmedTrailing = line.replace(/[ \t]+$/g, "");

    if (!inFence) {
      if (trimmedTrailing === "") {
        blankRun++;
        // Collapse runs of blank lines to at most 2 (outside fences only).
        if (blankRun <= 2) out.push("");
        continue;
      }
      blankRun = 0;
    }

    out.push(trimmedTrailing);
  }

  text = out.join("\n");

  // Ensure exactly one newline at EOF.
  text = text.replace(/\n*$/g, "\n");

  return { fixed: text, changed: text !== original };
}

function lintMarkdown(content: string, filePath: string, options: LintOptions): Finding[] {
  const findings: Finding[] = [];

  const normalized = content.replaceAll("\r\n", "\n").replaceAll("\r", "\n");
  const lines = splitLines(normalized);

  let inFence = false;
  let fence: Fence | null = null;
  let fenceStartLine = 0;

  for (let idx = 0; idx < lines.length; idx++) {
    const lineNo = idx + 1;
    const line = lines[idx];

    const fenceStart = parseFenceStart(line);
    if (fenceStart) {
      if (!inFence) {
        inFence = true;
        fence = fenceStart;
        fenceStartLine = lineNo;
      } else if (fence && isFenceClose(line, fence)) {
        inFence = false;
        fence = null;
        fenceStartLine = 0;
      }
    }

    // MD001: trailing whitespace (fixable)
    if (/[ \t]+$/.test(line)) {
      findings.push({
        filePath,
        line: lineNo,
        rule: "MD001",
        severity: "error",
        message: "Trailing whitespace",
      });
    }

    // MD002: tabs outside fences (style)
    if (!inFence && /\t/.test(line)) {
      findings.push({
        filePath,
        line: lineNo,
        rule: "MD002",
        severity: options.strict ? "error" : "warn",
        message: "Tab character found (prefer spaces)",
      });
    }

    // MD010/MD011 (light): headings should be surrounded by blank lines (warn by default)
    if (!inFence && /^#{1,6} /.test(line)) {
      const prev = idx > 0 ? lines[idx - 1] : "";
      const next = idx + 1 < lines.length ? lines[idx + 1] : "";

      if (idx > 0 && prev.trim() !== "") {
        findings.push({
          filePath,
          line: lineNo,
          rule: "MD010",
          severity: options.strict ? "error" : "warn",
          message: "Heading should be preceded by a blank line",
        });
      }

      if (next.trim() !== "") {
        findings.push({
          filePath,
          line: lineNo,
          rule: "MD011",
          severity: options.strict ? "error" : "warn",
          message: "Heading should be followed by a blank line",
        });
      }
    }

    // MD029/ol-prefix: ordered list item prefix style 1/1/1
    // Enforce `1.` as the prefix for every ordered list item.
    if (!inFence) {
      const match = /^\s*(?<num>\d+)\.\s+/.exec(line);
      const actual = match?.groups?.num;
      if (actual && actual !== "1") {
        findings.push({
          filePath,
          line: lineNo,
          rule: "MD029/ol-prefix",
          severity: options.strict ? "error" : "warn",
          message: `Ordered list item prefix [Expected: 1; Actual: ${actual}; Style: 1/1/1]`,
        });
      }
    }
  }

  // MD003: file should end with a newline
  if (!normalized.endsWith("\n")) {
    findings.push({
      filePath,
      line: lines.length,
      rule: "MD003",
      severity: "error",
      message: "File must end with a newline",
    });
  }

  // MD004: fenced code blocks must be closed
  if (inFence) {
    findings.push({
      filePath,
      line: fenceStartLine || 1,
      rule: "MD004",
      severity: "error",
      message: "Unclosed fenced code block",
    });
  }

  return findings;
}

function formatFinding(f: Finding): string {
  return `${f.filePath}:${f.line} [${f.severity}] ${f.rule} ${f.message}`;
}

function countErrors(findings: Finding[]): number {
  return findings.filter((f) => f.severity === "error").length;
}

async function main() {
  const { options, paths } = parseArgs(Deno.args);

  const markdownFiles = await collectMarkdownFiles(paths);
  if (markdownFiles.length === 0) {
    console.log("No markdown files found.");
    return;
  }

  let totalFindings: Finding[] = [];
  let fixedCount = 0;

  for (const filePath of markdownFiles) {
    if (options.verbose) console.log(`Linting ${filePath}`);

    const original = await Deno.readTextFile(filePath);

    if (options.fix) {
      const { fixed, changed } = applySafeFixes(original);
      if (changed) {
        await Deno.writeTextFile(filePath, fixed);
        fixedCount++;
      }
    }

    const content = options.fix ? await Deno.readTextFile(filePath) : original;
    const findings = lintMarkdown(content, filePath, options);

    // In non-strict mode, warnings are informational; errors fail.
    totalFindings = totalFindings.concat(findings);
  }

  for (const finding of totalFindings) {
    console.log(formatFinding(finding));
  }

  if (options.fix) {
    console.log(`Fixed ${fixedCount} file(s).`);
  }

  const errors = countErrors(totalFindings);
  const warns = totalFindings.length - errors;

  if (totalFindings.length === 0) {
    console.log("Markdown lint: OK");
    return;
  }

  console.log(`Markdown lint: ${errors} error(s), ${warns} warning(s)`);

  if (errors > 0) {
    Deno.exit(1);
  }
}

if (import.meta.main) {
  await main();
}
