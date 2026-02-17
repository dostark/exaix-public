/**
 * validate_architecture.ts
 *
 * Enforces architectural standards:
 * 1. Every .ts file in src/ must have a standardized @module header.
 * 2. Every .ts file in src/ must be "grounded" by ARCHITECTURE.md (directly or transitively).
 */

import { join, relative } from "@std/path";
import { walk } from "@std/fs";

const ROOT = Deno.cwd();
const SRC_DIR = join(ROOT, "src");
const ARCH_DOC = join(ROOT, "ARCHITECTURE.md");

interface ModuleInfo {
  path?: string;
  moduleName?: string;
  description?: string;
  layer?: string;
  dependencies: string[];
  relatedFiles: string[];
  dependenciesProvided: boolean;
  relatedFilesProvided: boolean;
  isGrounded: boolean;
}

async function validate() {
  console.log("🔍 Validating Architecture Grounding & Headers...");

  const allFiles = new Set<string>();
  const moduleMap = new Map<string, ModuleInfo>();
  const groundedFiles = new Set<string>();

  // 1. Gather all .ts files in src/
  for await (const entry of walk(SRC_DIR, { includeDirs: false })) {
    if (entry.path.endsWith(".test.ts") || entry.path.endsWith("_test.ts") || !entry.path.endsWith(".ts")) continue;

    const relPath = relative(ROOT, entry.path);
    allFiles.add(relPath);
  }

  // 2. Parse ARCHITECTURE.md for explicit grounding
  const archContent = await Deno.readTextFile(ARCH_DOC);
  const explicitPathRegex = /src\/[a-zA-Z0-9_\-\/]+\.ts/g;
  let match;
  while ((match = explicitPathRegex.exec(archContent)) !== null) {
    const foundPath = match[0];
    if (allFiles.has(foundPath)) {
      groundedFiles.add(foundPath);
    }
  }

  // Also check for directory-level grounding like src/cli/*.ts or src/*.ts
  const explicitDirRegex = /src\/([a-zA-Z0-9_\-\/]+\/)?\*\.ts/g;
  while ((match = explicitDirRegex.exec(archContent)) !== null) {
    const dirPath = match[0].replace("/*.ts", "");
    for (const file of allFiles) {
      if (file.startsWith(dirPath)) {
        groundedFiles.add(file);
      }
    }
  }

  console.log(`📍 Explicitly grounded in ARCHITECTURE.md: ${groundedFiles.size} files`);

  // 3. Parse headers and build dependency graph
  let headerFailures = 0;
  for (const relPath of allFiles) {
    const fullPath = join(ROOT, relPath);
    const content = await Deno.readTextFile(fullPath);

    const info = parseHeader(relPath, content);
    const missingFields = [];
    if (!info.moduleName) missingFields.push("@module");
    if (!info.path) missingFields.push("@path");
    if (!info.description) missingFields.push("@description");
    if (!info.layer) missingFields.push("@architectural-layer");
    if (!info.dependenciesProvided) missingFields.push("@dependencies");
    if (!info.relatedFilesProvided) missingFields.push("@related-files");

    if (missingFields.length > 0) {
      console.error(`❌ Invalid header in ${relPath}. Missing fields: ${missingFields.join(", ")}`);
      headerFailures++;
    }
    moduleMap.set(relPath, info);
  }

  // 4. Perform reachability analysis (Transitive Grounding)
  const moduleNameToPath = new Map<string, string>();
  for (const [path, info] of moduleMap.entries()) {
    if (info.moduleName) {
      moduleNameToPath.set(info.moduleName, path);
    }
  }

  const queue = Array.from(groundedFiles);
  const fullyGrounded = new Set<string>(groundedFiles);

  while (queue.length > 0) {
    const current = queue.shift()!;
    const info = moduleMap.get(current);
    if (!info) continue;

    const links = [...info.dependencies, ...info.relatedFiles];
    for (const link of links) {
      const resolvedPath = allFiles.has(link) ? link : moduleNameToPath.get(link);

      if (resolvedPath && allFiles.has(resolvedPath) && !fullyGrounded.has(resolvedPath)) {
        fullyGrounded.add(resolvedPath);
        queue.push(resolvedPath);
      }
    }
  }

  // 5. Report results
  const ungrounded = Array.from(allFiles).filter((f) => !fullyGrounded.has(f));

  console.log("\n--- Validation Summary ---");
  console.log(`Total Source Files: ${allFiles.size}`);
  console.log(`Header Validation:  ${allFiles.size - headerFailures} PASS, ${headerFailures} FAIL`);
  console.log(`Grounding Status:   ${fullyGrounded.size} GROUNDED, ${ungrounded.length} UNGROUNDED`);

  if (ungrounded.length > 0) {
    console.log("\n❌ Ungrounded Modules (Dead Documentation Zones):");
    ungrounded.sort().forEach((f) => console.log(`  - ${f}`));
  }

  if (headerFailures > 0 || ungrounded.length > 0) {
    Deno.exit(1);
  } else {
    console.log("\n✅ Architecture is fully grounded and valid!");
  }
}

function parseHeader(_filePath: string, content: string): ModuleInfo {
  const info: ModuleInfo = {
    dependencies: [],
    relatedFiles: [],
    dependenciesProvided: false,
    relatedFilesProvided: false,
    isGrounded: false,
  };

  const headerMatch = content.match(/\/\*\*([\s\S]*?)\*\//);
  if (!headerMatch) return info;

  const header = headerMatch[1];

  const moduleMatch = header.match(/@module\s+([^\n]+)/);
  const pathMatch = header.match(/@path\s+([^\n]+)/);
  const architecturalLayer = header.match(/@architectural-layer\s+([^\n]+)/);
  const description = header.match(/@description\s+([^\n]+)/);

  if (moduleMatch) info.moduleName = moduleMatch[1].trim();
  if (pathMatch) info.path = pathMatch[1].trim();
  if (architecturalLayer) info.layer = architecturalLayer[1].trim();
  if (description) info.description = description[1].trim();

  // Parse arrays like [file1.ts, file2.ts]
  const depsMatch = header.match(/@dependencies\s+\[(.*?)\]/);
  if (depsMatch) {
    info.dependenciesProvided = true;
    info.dependencies = depsMatch[1].split(",").map((s) => s.trim()).filter((s) => s);
  }

  const relatedMatch = header.match(/@related-files\s+\[(.*?)\]/);
  if (relatedMatch) {
    info.relatedFilesProvided = true;
    info.relatedFiles = relatedMatch[1].split(",").map((s) => s.trim()).filter((s) => s);
  }

  return info;
}

if (import.meta.main) {
  validate();
}
