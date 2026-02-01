// Unit tests to verify Step 10.6 OpenAI enhancements are properly implemented

import { assert, assertExists } from "@std/assert";
import {
  assertChunksWereGenerated,
  assertEmbeddingsGenerated,
  assertFilesExist,
  assertFrontmatterSchemaAndShortSummary,
} from "../helpers/copilot_assertions.ts";

Deno.test("OpenAI enhancements: verify required files exist", async () => {
  const files = [
    ".copilot/providers/openai.md",
    ".copilot/providers/openai-rag.md",
    ".copilot/cross-reference.md",
    ".copilot/prompts/openai-quickstart.md",
    ".copilot/prompts/openai-rag-context-injection.md",
    ".copilot/prompts/openai-tdd-workflow.md",
    ".copilot/prompts/openai-debugging-systematic.md",
  ];

  await assertFilesExist(files);
});

Deno.test("OpenAI enhancements: verify openai.md required sections", async () => {
  const md = await Deno.readTextFile(".copilot/providers/openai.md");

  assert(md.includes("Key points"), "Should have Key points");
  assert(/Canonical prompt \(short\)/.test(md), "Should have Canonical prompt (short)");
  assert(/Examples/i.test(md), "Should have Examples");
  assert(md.includes("Do / Don't"), "Should have Do / Don't");

  // Medium priority guardrails
  assert(md.includes("Output format (required)"), "Should define output format contract");
  assert(md.includes("Ask-when-ambiguous rule"), "Should define ask-when-ambiguous rule");
  assert(md.includes("Examples (by level)"), "Should include multi-level examples");
});

Deno.test("OpenAI enhancements: verify openai-rag.md structure", async () => {
  const md = await Deno.readTextFile(".copilot/providers/openai-rag.md");

  assert(md.includes("Key points"), "Should have Key points");
  assert(md.includes("## Overview"), "Should have Overview section");
  assert(md.includes("## RAG Workflow"), "Should have RAG Workflow section");
  assert(md.includes("## Tools"), "Should have Tools section");
  assert(md.includes("Canonical prompt (short)"), "Should have Canonical prompt (short)");
  assert(md.includes("## Examples"), "Should have Examples section");
  assert(md.includes("Examples (by level)"), "Should include multi-level examples");
  assert(md.includes("## Do / Don't"), "Should have Do / Don't section");

  // Tool references
  assert(md.includes("scripts/inspect_embeddings.ts"), "Should reference inspect_embeddings tool");
  assert(md.includes("scripts/inject_agent_context.ts"), "Should reference inject_agent_context tool");
});

Deno.test("OpenAI enhancements: verify frontmatter schema + short_summary limits", async () => {
  const files = [
    ".copilot/providers/openai.md",
    ".copilot/providers/openai-rag.md",
    ".copilot/prompts/openai-quickstart.md",
    ".copilot/prompts/openai-rag-context-injection.md",
    ".copilot/prompts/openai-tdd-workflow.md",
    ".copilot/prompts/openai-debugging-systematic.md",
  ];

  await assertFrontmatterSchemaAndShortSummary(files);
});

Deno.test("OpenAI enhancements: verify manifest includes openai-rag", async () => {
  const manifestText = await Deno.readTextFile(".copilot/manifest.json");
  const manifest = JSON.parse(manifestText);

  assert(Array.isArray(manifest.docs), "Manifest should have docs array");

  const paths = manifest.docs.map((d: { path: string }) => d.path);
  assert(paths.includes(".copilot/providers/openai-rag.md"), "Manifest should include openai-rag.md");

  const openaiRagDoc = manifest.docs.find((d: { path: string }) => d.path === ".copilot/providers/openai-rag.md");
  assertExists(openaiRagDoc, "openai-rag.md should be in manifest");
  assert(Array.isArray(openaiRagDoc.chunks), "openai-rag.md should have chunks array");
  assert(openaiRagDoc.chunks.length > 0, "openai-rag.md should have at least 1 chunk");
});

Deno.test("OpenAI enhancements: verify embeddings generated", async () => {
  const embeddingFiles = [
    ".copilot/embeddings/openai.md.json",
    ".copilot/embeddings/openai-rag.md.json",
  ];

  await assertEmbeddingsGenerated(embeddingFiles);
});

Deno.test("OpenAI enhancements: verify chunks were generated", async () => {
  const patterns = [
    "openai.md.chunk",
    "openai-rag.md.chunk",
  ];

  await assertChunksWereGenerated(patterns);
});

Deno.test("OpenAI enhancements: verify context injection works", async () => {
  const { inject } = await import("../../scripts/inject_agent_context.ts");

  const ragResult = await inject("openai", "OpenAI RAG context injection", 4);
  assert(ragResult.found, "Should find RAG-related OpenAI doc");
  assert(
    (ragResult.path || "").includes(".copilot/providers/openai") ||
      (ragResult.path || "").includes(".copilot/prompts/openai-"),
    "Should return an OpenAI agent doc or OpenAI prompt template",
  );
  assert(
    (ragResult.snippet || "").toLowerCase().includes("rag") ||
      (ragResult.snippet || "").toLowerCase().includes("inject"),
    "Injected snippet should mention RAG or injection",
  );
});
