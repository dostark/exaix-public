#!/usr/bin/env -S deno run --allow-read
// ...existing code...
// Copyright 2026 ExoFrame authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import { walk } from "https://deno.land/std@0.200.0/fs/mod.ts";

interface Rule {
  name: string;
  regex: RegExp;
  message: string;
  severity: "error" | "warn";
}

// Parse CLI options
const args = new Set(Deno.args);
const strictImports = args.has("--strict-imports");

// Rules correspond to the code style guidelines in CODE_STYLE.md.  When a
// violation is found we print a human-friendly explanation; the script exits
// with a non-zero status if any errors were detected so it can be used in
// pre-commit hooks or CI.
const rules: Rule[] = [
  // Dynamic import checks are only enabled if --strict-imports is passed
  ...(strictImports
    ? [
      {
        name: "import-inside-statement",
        regex: /^(?!\s*import\s+).*(import\s*\().*$/,
        message:
          "Use of import() inside other statements (e.g., if, function, loop) is prohibited. All imports must be at the top level.",
        severity: "error" as const,
      },
      {
        name: "dynamic-import",
        regex: /\bimport\s*\(/,
        message:
          "Dynamic import statements (import(...)) are discouraged. If used, document the rationale in a comment above the import.",
        severity: "warn" as const,
      },
    ]
    : []),
  {
    name: "explicit-unknown-array",
    regex: /:\s*unknown\[\]/,
    message: "Using 'unknown[]' as a type is forbidden; use a specific type instead.",
    severity: "error" as const,
  },
  {
    name: "explicit-any-array",
    regex: /:\s*any\[\]/,
    message: "Using 'any[]' as a type is forbidden; use a specific type instead.",
    severity: "error" as const,
  },
  {
    name: "ts-suppression-pragmas",
    regex: /@ts-(?:ignore|expect-error|nocheck)/,
    message:
      "TypeScript suppression pragmas (e.g. @ts-ignore, @ts-expect-error, @ts-nocheck) are prohibited; fix the underlying type error instead.",
    severity: "error" as const,
  },
  {
    name: "deno-lint-no-explicit-any",
    regex: /\/\/\s*deno-lint-ignore\s+no-explicit-any/,
    message: "Using '// deno-lint-ignore no-explicit-any' is not allowed; address the typing issue explicitly.",
    severity: "error" as const,
  },
  {
    name: "explicit-any-cast",
    regex: /\bas\s+any\b/,
    message: "Casting to 'any' (e.g. 'foo as any') is forbidden.",
    severity: "error" as const,
  },
  {
    name: "typeof-cast",
    regex: /\bas\s+typeof\s+(?!globalThis\.fetch\b)([a-zA-Z_]\w*)\s+(?!\&)/,
    message:
      "Casting via 'as typeof <var>' is treated as an 'any' escape and is forbidden. Exceptions: 'as typeof globalThis.fetch' in tests, and intersection types like 'as typeof Deno & {...}'.",
    severity: "error" as const,
  },
  {
    name: "double-cast",
    regex: /as\s+unknown\s+as/,
    message: "Do not use double casting '... as unknown as ...'; use proper narrowing instead.",
    severity: "error" as const,
  },
  {
    name: "record-any",
    regex: /Record<\s*string\s*,\s*any\s*>/,
    message: "'Record<string, any>' is weak and prohibited; define a more specific type.",
    severity: "error" as const,
  },
  {
    name: "record-unknown",
    regex: /Record<\s*string\s*,\s*unknown\s*>/,
    message: "'Record<string, unknown>' is prohibited; define a specific interface or type alias instead.",
    severity: "error" as const,
  },
  {
    name: "promise-response-return",
    regex: /:\s*Promise\s*<\s*Response\s*>\s*=>/,
    message:
      "'Promise<Response>' as return type in arrow functions is weak typing; define a specific return type interface instead.",
    severity: "error" as const,
  },
];

let errorCount = 0;
let warnCount = 0;

async function checkFile(path: string) {
  const text = await Deno.readTextFile(path);
  const lines = text.split(/\r?\n/);

  rules.forEach((rule) => {
    lines.forEach((line, idx) => {
      if (rule.regex.test(line)) {
        const location = `${path}:${idx + 1}`;
        const prefix = rule.severity === "error" ? "ERROR" : "WARN";
        console.log(`${prefix} [${rule.name}] ${location} – ${rule.message}`);
        if (rule.severity === "error") {
          errorCount++;
        } else {
          warnCount++;
        }
      }
    });
  });
}

async function main() {
  for await (
    const entry of walk(Deno.cwd(), {
      includeDirs: false,
      exts: ["ts", "tsx"],
      followSymlinks: false,
      skip: [/^\.git$/, /^node_modules$/, /check_code_style\.ts$/],
    })
  ) {
    // skip generated code or scripts if necessary
    if (
      entry.path.includes("/dist/") ||
      entry.path.includes("/coverage/") ||
      entry.path.includes("/.copilot/")
    ) {
      continue;
    }
    if (!entry.isFile) {
      continue;
    }
    await checkFile(entry.path);
  }

  console.log(`\nstyle check completed: ${errorCount} error(s), ${warnCount} warning(s)`);
  if (errorCount > 0) {
    Deno.exit(1);
  }
}

if (import.meta.main) {
  main();
}
