import { parse } from "https://deno.land/std@0.224.0/flags/mod.ts";
import { walk } from "https://deno.land/std@0.224.0/fs/walk.ts";
// Dynamic loader for a JS/TS parser (tries multiple CDNs).
export async function getBabelParse(): Promise<(code: string, opts?: any) => any> {
  // Try local/npm first (works with Deno's npm support), then deno.land X modules, then CDNs
  const localCandidates = [
    "npm:@babel/parser",
    "https://deno.land/x/deno_ast@0.5.0/mod.ts",
    "https://deno.land/x/deno_ast@0.4.0/mod.ts",
  ];

  for (const url of localCandidates) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const mod: any = await import(url);
      if (mod.parse) return mod.parse;
      if (mod.default && typeof mod.default.parse === "function") return mod.default.parse;
      if (mod.default && typeof mod.default === "function") return mod.default;
    } catch (_e) {
      // try next
    }
  }

  const cdnCandidates = [
    "https://esm.sh/@babel/parser@7.22.9",
    "https://cdn.skypack.dev/@babel/parser@7.22.9",
    "https://cdn.jsdelivr.net/npm/@babel/parser@7.22.9/lib/index.js",
    "https://unpkg.com/@babel/parser@7.22.9/lib/index.js",
    "https://esm.sh/@babel/parser",
  ];

  for (const url of cdnCandidates) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const mod: any = await import(url);
      if (mod.parse) return mod.parse;
      if (mod.default && typeof mod.default.parse === "function") return mod.default.parse;
      if (mod.default && typeof mod.default === "function") return mod.default;
    } catch (_e) {
      // try next
    }
  }

  throw new Error(
    "Could not load a JS parser from local/npm or CDN; please ensure network access or install a local parser (e.g. npm:@babel/parser).",
  );
}

/**
 * Script to measure code complexity
 *
 * Usage:
 * deno run --allow-run --allow-read scripts/measure_complexity.ts [--threshold <num>]
 */

const flags = parse(Deno.args, {
  string: ["threshold", "topFiles", "topFns"],
  boolean: ["json"],
  default: { threshold: "10", topFiles: "5", topFns: "5", json: false },
});

const THRESHOLD = parseFloat(flags.threshold);
const TOP_FILES = parseInt(String(flags.topFiles || "5"), 10) || 5;
const TOP_FNS = parseInt(String(flags.topFns || "5"), 10) || 5;
const OUTPUT_JSON = !!flags.json;

// AST-based cyclomatic complexity per-function using Babel parser.
// Cyclomatic complexity heuristic:
// - Start at 1 per function
// - +1 for each: IfStatement, For/While/DoWhile/ForIn/ForOf, SwitchCase (with test), CatchClause,
//   ConditionalExpression (ternary), LogicalExpression (||, &&)
// We parse TypeScript/JS with @babel/parser and walk the AST.

type Node = any;

export function traverse(node: Node, cb: (n: Node, parent?: Node) => void, parent?: Node) {
  if (!node || typeof node !== "object") return;
  cb(node, parent);

  for (const key of Object.keys(node)) {
    if (key === "loc" || key === "range") continue;
    const child = node[key];
    if (Array.isArray(child)) {
      for (const c of child) traverse(c, cb, node);
    } else if (child && typeof child === "object" && child.type) {
      traverse(child, cb, node);
    }
  }
}

export function complexityForNode(node: Node): number {
  let complexity = 1;

  traverse(node, (n) => {
    if (!n || typeof n.type !== "string") return;

    switch (n.type) {
      case "IfStatement":
        complexity += 1;
        if (n.alternate && n.alternate.type === "IfStatement") {
          // else if counts as an additional decision (already covered by inner IfStatement)
        }
        break;
      case "ForStatement":
      case "ForInStatement":
      case "ForOfStatement":
      case "WhileStatement":
      case "DoWhileStatement":
        complexity += 1;
        break;
      case "SwitchCase":
        // each `case` (with a test) increases complexity
        if (n.test) complexity += 1;
        break;
      case "CatchClause":
        complexity += 1;
        break;
      case "ConditionalExpression":
        // ternary
        complexity += 1;
        break;
      case "LogicalExpression":
        if (n.operator === "||" || n.operator === "&&") complexity += 1;
        break;
      default:
        break;
    }
  });

  return complexity;
}

export function calculateComplexityFromText(content: string): number {
  let complexity = 1;
  const tokens: RegExp[] = [
    /\bif\b/g,
    /\belse\b/g,
    /\bfor\b/g,
    /\bwhile\b/g,
    /\bcase\b/g,
    /\bcatch\b/g,
    /\?/g,
    /\|\|/g,
    /\&\&/g,
  ];
  for (const t of tokens) {
    const m = content.match(t);
    if (m) complexity += m.length;
  }
  return complexity;
}

async function runComplexityCheck() {
  if (!OUTPUT_JSON) console.log(`🧠 Running AST-based complexity analysis (Threshold: ${THRESHOLD})...`);

  let totalFiles = 0;
  let totalFunctions = 0;
  const fileSummaries: Array<
    { path: string; fileComplexity: number; functions: Array<{ name: string; complexity: number; line?: number }> }
  > = [];

  let babelParse: ((code: string, opts?: any) => any) | null = null;
  try {
    babelParse = await getBabelParse();
  } catch (_e) {
    console.warn("⚠️  Could not load AST parser; falling back to heuristic per-function analysis.");
  }

  for await (const entry of walk("src", { includeDirs: false, exts: [".ts", ".tsx", ".js", ".jsx"] })) {
    const content = await Deno.readTextFile(entry.path);
    let ast: Node | null = null;

    try {
      if (babelParse) {
        ast = babelParse(content, {
          sourceType: "module",
          plugins: [
            "typescript",
            "jsx",
            "decorators-legacy",
            "classProperties",
            "classPrivateMethods",
            "privateIn",
          ],
          errorRecovery: true,
        }) as Node;
      }
    } catch (_e) {
      console.error(`Failed to parse ${entry.path}: ${_e}`);
      // continue to fallback below
    }

    const functions: Array<{ node?: Node; name: string; line?: number; text?: string }> = [];

    if (ast) {
      traverse(ast, (n: Node) => {
        if (!n || typeof n.type !== "string") return;
        switch (n.type) {
          case "FunctionDeclaration":
            functions.push({ node: n, name: n.id?.name || "<anonymous>", line: n.loc?.start?.line });
            break;
          case "FunctionExpression":
            functions.push({ node: n, name: n.id?.name || "<anonymous>", line: n.loc?.start?.line });
            break;
          case "ArrowFunctionExpression":
            functions.push({ node: n, name: "<arrow>", line: n.loc?.start?.line });
            break;
          case "ClassMethod":
          case "ClassPrivateMethod":
            functions.push({ node: n, name: n.key?.name || "<method>", line: n.loc?.start?.line });
            break;
          case "ObjectMethod":
            functions.push({ node: n, name: n.key?.name || "<method>", line: n.loc?.start?.line });
            break;
          default:
            break;
        }
      });
    } else {
      // Fallback: naive regex to find function-like blocks and capture text
      const fnRegexes = [
        /function\s+([A-Za-z0-9_$]+)\s*\([^)]*\)\s*\{([\s\S]*?)\n\}/g,
        /([A-Za-z0-9_$]+)\s*=\s*\([^)]*\)\s*=>\s*\{([\s\S]*?)\n\}/g,
        /([A-Za-z0-9_$]+)\s*:\s*function\s*\([^)]*\)\s*\{([\s\S]*?)\n\}/g,
      ];

      for (const rx of fnRegexes) {
        let m: RegExpExecArray | null;
        while ((m = rx.exec(content))) {
          functions.push({ name: m[1] || "<anonymous>", text: m[2], line: undefined });
        }
      }
    }

    const fnResults: Array<{ name: string; complexity: number; line?: number }> = [];
    let fileComplexity = 0;

    for (const fn of functions) {
      let c = 0;
      if (fn.node) {
        c = complexityForNode(fn.node);
      } else if (fn.text) {
        c = calculateComplexityFromText(fn.text);
      } else {
        c = 1;
      }
      fnResults.push({ name: fn.name, complexity: c, line: fn.line });
      fileComplexity += c;
    }

    // Also compute top-level (module) complexity by traversing AST but skipping function bodies
    let topLevelComplexity = 0;
    if (ast) {
      traverse(ast, (n: Node, parent?: Node) => {
        if (!n || typeof n.type !== "string") return;
        // skip traversing inside functions when accounting for top-level
        if (
          parent &&
          (parent.type === "FunctionDeclaration" || parent.type === "FunctionExpression" ||
            parent.type === "ArrowFunctionExpression")
        ) return;
        switch (n.type) {
          case "IfStatement":
          case "ForStatement":
          case "ForInStatement":
          case "ForOfStatement":
          case "WhileStatement":
          case "DoWhileStatement":
          case "CatchClause":
          case "ConditionalExpression":
            topLevelComplexity += 1;
            break;
          case "LogicalExpression":
            if (n.operator === "||" || n.operator === "&&") topLevelComplexity += 1;
            break;
          case "SwitchCase":
            if (n.test) topLevelComplexity += 1;
            break;
          default:
            break;
        }
      });
    } else {
      topLevelComplexity = calculateComplexityFromText(content);
    }

    fileComplexity += topLevelComplexity;

    fileSummaries.push({
      path: entry.path,
      fileComplexity,
      functions: fnResults.sort((a, b) => b.complexity - a.complexity),
    });

    totalFiles += 1;
    totalFunctions += fnResults.length;
  }

  // Aggregate and report
  const totalComplexity = fileSummaries.reduce((s, f) => s + f.fileComplexity, 0);
  const avgFileComplexity = totalFiles ? totalComplexity / totalFiles : 0;

  if (!OUTPUT_JSON) console.log("----------------------------------------");
  if (!OUTPUT_JSON) console.log(`📊 Analysis of ${totalFiles} files, ${totalFunctions} functions`);
  if (!OUTPUT_JSON) console.log(`📈 Average File Complexity: ${avgFileComplexity.toFixed(2)}`);

  // Top files
  const topFiles = fileSummaries.sort((a, b) => b.fileComplexity - a.fileComplexity).slice(0, TOP_FILES);
  if (!OUTPUT_JSON) console.log(`🏔️  Top ${TOP_FILES} files by complexity:`);
  for (const f of topFiles) {
    if (!OUTPUT_JSON) console.log(`  - ${f.path}: ${f.fileComplexity}`);
    const topFns = f.functions.slice(0, TOP_FNS);
    for (const fn of topFns) {
      if (!OUTPUT_JSON) console.log(`      • ${fn.name} (line ${fn.line ?? "?"}): ${fn.complexity}`);
    }
  }

  // Flag files/functions above threshold
  if (!OUTPUT_JSON) console.log("\n⚠️  Items exceeding threshold:");
  const exceeding: {
    files: Array<{ path: string; complexity: number }>;
    functions: Array<{ path: string; name: string; complexity: number; line?: number }>;
  } = { files: [], functions: [] };
  for (const f of fileSummaries) {
    if (f.fileComplexity >= THRESHOLD) {
      if (!OUTPUT_JSON) console.log(`  - File ${f.path}: ${f.fileComplexity}`);
      exceeding.files.push({ path: f.path, complexity: f.fileComplexity });
    }
    for (const fn of f.functions) {
      if (fn.complexity >= THRESHOLD) {
        if (!OUTPUT_JSON) {
          console.log(`    • Function ${fn.name} in ${f.path} (line ${fn.line ?? "?"}): ${fn.complexity}`);
        }
        exceeding.functions.push({ path: f.path, name: fn.name, complexity: fn.complexity, line: fn.line });
      }
    }
  }

  if (!OUTPUT_JSON) {
    if (avgFileComplexity > 50) {
      console.log(`\n⚠️  Average file complexity seems high.`);
    } else {
      console.log(`\n✅ Complexity matches expectations.`);
    }
  }

  const result = {
    meta: { totalFiles, totalFunctions, avgFileComplexity, threshold: THRESHOLD, topFiles: TOP_FILES, topFns: TOP_FNS },
    topFiles,
    fileSummaries,
    exceeding,
  };

  if (OUTPUT_JSON) {
    console.log(JSON.stringify(result, null, 2));
  }
}

if (import.meta.main) {
  await runComplexityCheck();
}
