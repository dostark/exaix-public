/**
 * @module CopilotAssertions
 * @path tests/helpers/copilot_assertions.ts
 * @description Provides specialized assertions for validating Copilot directives
 * and magic value externalization within the test suite.
 */

import { assert, assertExists } from "@std/assert";
import { parse } from "@std/yaml";

interface Frontmatter {
  agent: string;
  scope: string;
  title: string;
  short_summary: string;
  version: string;
  [key: string]: unknown;
}

export async function assertFilesExist(files: string[]): Promise<void> {
  for (const file of files) {
    const stat = await Deno.stat(file);
    assert(stat.isFile, `${file} should exist and be a file`);
  }
}

export async function assertFrontmatterSchemaAndShortSummary(
  files: string[],
  options: { maxSummaryLength: number } = { maxSummaryLength: 200 },
): Promise<void> {
  for (const filePath of files) {
    const content = await Deno.readTextFile(filePath);
    const fmMatch = content.match(/^---\n([\s\S]*?)\n---/);
    assertExists(fmMatch, `${filePath} should have YAML frontmatter`);

    const fm = parse(fmMatch[1]) as Frontmatter;

    assert(fm.agent, `${filePath} should have agent`);
    assert(fm.scope, `${filePath} should have scope`);
    assert(fm.title, `${filePath} should have title`);
    assert(fm.short_summary, `${filePath} should have short_summary`);
    assert(fm.version, `${filePath} should have version`);

    const summary = fm.short_summary as string;
    assert(
      summary.length <= options.maxSummaryLength,
      `${filePath} short_summary should be ≤${options.maxSummaryLength} chars, got ${summary.length}`,
    );
  }
}

export async function assertEmbeddingsGenerated(embeddingFiles: string[]): Promise<void> {
  for (const file of embeddingFiles) {
    const stat = await Deno.stat(file);
    assert(stat.isFile, `${file} should exist`);

    const content = await Deno.readTextFile(file);
    const embeddingData = JSON.parse(content);
    assert(embeddingData.path, "Embedding file should have path");
    assert(embeddingData.title, "Embedding file should have title");
    assert(Array.isArray(embeddingData.vecs), "Embedding file should have vecs array");
    assert(embeddingData.vecs.length > 0, "Embedding file should have at least 1 vector");

    const firstVec = embeddingData.vecs[0];
    assert(firstVec.text, "Vector should have text");
    assert(Array.isArray(firstVec.vector), "Vector should have vector array");
    assert(firstVec.vector.length === 64, "Vector should be 64-dimensional");
  }
}

export async function assertChunksWereGenerated(patterns: string[], chunkDir = ".copilot/chunks"): Promise<void> {
  for (const pattern of patterns) {
    let found = false;
    for await (const entry of Deno.readDir(chunkDir)) {
      if (!entry.isFile) continue;
      if (!entry.name.startsWith(pattern)) continue;
      found = true;

      const content = await Deno.readTextFile(`${chunkDir}/${entry.name}`);
      assert(content.length > 0, `Chunk file ${entry.name} should not be empty`);
    }
    assert(found, `Should have at least one chunk file matching ${pattern}`);
  }
}
