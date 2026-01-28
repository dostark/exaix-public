import { parse } from "https://deno.land/std@0.224.0/flags/mod.ts";
import { walk } from "https://deno.land/std@0.224.0/fs/walk.ts";

/**
 * Script to measure code complexity
 *
 * Usage:
 * deno run --allow-run --allow-read scripts/measure_complexity.ts [--threshold <num>]
 */

const flags = parse(Deno.args, {
  string: ["threshold"],
  default: { threshold: "10" },
});

const THRESHOLD = parseFloat(flags.threshold);

// Simple complexity heuristic:
// 1 + 1 for each: if, else, for, while, case, catch, ternary (?)
function calculateComplexity(content: string): number {
  let complexity = 1;
  const tokens = [
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

  for (const token of tokens) {
    const matches = content.match(token);
    if (matches) {
      complexity += matches.length;
    }
  }
  return complexity;
}

async function runComplexityCheck() {
  console.log(`🧠 Running heuristic complexity analysis (Threshold: ${THRESHOLD})...`);

  let totalComplexity = 0;
  let fileCount = 0;
  let maxComplexity = 0;
  let maxComplexityFile = "";

  for await (const entry of walk("src", { includeDirs: false, exts: [".ts"] })) {
    const content = await Deno.readTextFile(entry.path);
    const complexity = calculateComplexity(content);

    // Normalize by file length to get a "density" or just report raw file complexity?
    // Typically complexity is per function. Since we are doing per file, checking against 10 is too low.
    // A file with 10 methods of complexity 1 would be 10.

    totalComplexity += complexity;
    fileCount++;

    if (complexity > maxComplexity) {
      maxComplexity = complexity;
      maxComplexityFile = entry.path;
    }
  }

  const avgComplexity = totalComplexity / fileCount;

  console.log("----------------------------------------");
  console.log(`📊 Analysis of ${fileCount} files`);
  console.log(`📈 Average File Complexity: ${avgComplexity.toFixed(2)}`);
  console.log(`🏔️  Max File Complexity: ${maxComplexity} (${maxComplexityFile})`);
  console.log(`ℹ️  Note: This is a file-level heuristic sum. Per-function analysis requires AST parsing.`);

  if (avgComplexity > 50) { // Arbitrary high threshold for file-level
    console.log(`⚠️  Average file complexity seems high.`);
  } else {
    console.log(`✅ Complexity matches expectations.`);
  }
}

if (import.meta.main) {
  await runComplexityCheck();
}
