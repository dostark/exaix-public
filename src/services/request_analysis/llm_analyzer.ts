/**
 * @module LlmAnalyzer
 * @path src/services/request_analysis/llm_analyzer.ts
 * @description LLM-powered request analysis strategy. Sends a structured prompt
 * to an `IModelProvider` and validates the JSON response against
 * `RequestAnalysisSchema` via `IOutputValidator`. Falls back to a minimal
 * safe `IRequestAnalysis` on any failure so callers never receive an exception.
 * @architectural-layer Services
 * @dependencies [src/ai/types.ts, src/services/output_validator.ts, src/shared/schemas/request_analysis.ts]
 * @related-files [src/services/request_analysis/request_analyzer.ts, src/services/request_analysis/mod.ts]
 */

import type { IModelProvider } from "../../ai/types.ts";
import type { IOutputValidator } from "../output_validator.ts";
import {
  type IRequestAnalysis,
  RequestAnalysisComplexity,
  RequestAnalysisSchema,
  RequestTaskType,
} from "../../shared/schemas/request_analysis.ts";
import { AnalysisMode } from "../../shared/types/request.ts";
import type { IRequestAnalysisContext } from "../../shared/interfaces/i_request_analyzer_service.ts";
import { ANALYZER_VERSION } from "../../shared/constants.ts";

// ---------------------------------------------------------------------------
// Analysis prompt template
// ---------------------------------------------------------------------------

const ANALYSIS_PROMPT_TEMPLATE = `You are a request intent analyzer for an AI orchestration system.
Analyze the following request and extract structured information.

REQUEST:
{REQUEST_TEXT}

{CONTEXT_SECTION}

Respond with ONLY a valid JSON object matching this exact structure (no markdown, no explanation):
{
  "goals": [{ "description": "string", "explicit": boolean, "priority": number (≥1) }],
  "requirements": [{ "description": "string", "confidence": number (0.0-1.0), "type": "functional|non-functional|constraint", "explicit": boolean }],
  "constraints": ["string"],
  "acceptanceCriteria": ["string"],
  "ambiguities": [{ "description": "string", "impact": "low|medium|high", "interpretations": ["string"], "clarificationQuestion": "string (optional, omit if unknown)" }],
  "actionabilityScore": number (0-100, higher = clearer/more actionable),
  "complexity": "simple, medium, complex, or epic",
  "taskType": "feature, bugfix, refactor, test, docs, analysis, or unknown",
  "tags": ["string"],
  "referencedFiles": ["string"],
  "metadata": {
    "analyzedAt": "ISO8601 timestamp",
    "durationMs": 0,
    "mode": "${AnalysisMode.LLM}",
    "analyzerVersion": "${ANALYZER_VERSION}"
  }
}

Rules:
- goals: list all distinct objectives; mark explicit=false for inferred goals
- requirements: concrete conditions the implementation must satisfy; confidence 0.0-1.0
- constraints: limitations or restrictions imposed (e.g. "no new dependencies")
- acceptanceCriteria: measurable conditions that define "done"
- ambiguities: unclear or underspecified aspects; impact low/medium/high
- actionabilityScore: 0=completely vague, 100=fully specified and ready to execute
- complexity: simple (<200 chars, ≤2 bullets), epic (multi-phase), complex (>10 bullets or >5 files), else medium
- taskType: primary verb signal (fix/bug→bugfix, refactor→refactor, test→test, document→docs, analyze→analysis, else feature)
- tags: topic keywords from the request
- referencedFiles: source file paths explicitly mentioned`;

function buildPrompt(requestText: string, context?: IRequestAnalysisContext): string {
  let contextSection = "";
  if (context) {
    const parts: string[] = [];
    if (context.agentId) parts.push(`Agent: ${context.agentId}`);
    if (context.priority) parts.push(`Priority: ${context.priority}`);
    if (context.filePaths?.length) parts.push(`Known files: ${context.filePaths.join(", ")}`);
    if (context.tags?.length) parts.push(`Existing tags: ${context.tags.join(", ")}`);
    if (parts.length > 0) {
      contextSection = `CONTEXT:\n${parts.join("\n")}\n`;
    }
  }
  return ANALYSIS_PROMPT_TEMPLATE
    .replace("{REQUEST_TEXT}", requestText)
    .replace("{CONTEXT_SECTION}", contextSection);
}

// ---------------------------------------------------------------------------
// Fallback analysis returned whenever LLM output is invalid
// ---------------------------------------------------------------------------

function buildFallback(requestText: string): IRequestAnalysis {
  return {
    goals: [],
    requirements: [],
    constraints: [],
    acceptanceCriteria: [],
    ambiguities: [],
    actionabilityScore: 0,
    complexity: requestText.trim().length <= 200 ? RequestAnalysisComplexity.SIMPLE : RequestAnalysisComplexity.MEDIUM,
    taskType: RequestTaskType.UNKNOWN,
    tags: [],
    referencedFiles: [],
    metadata: {
      analyzedAt: new Date().toISOString(),
      durationMs: 0,
      mode: AnalysisMode.LLM,
      analyzerVersion: ANALYZER_VERSION,
    },
  };
}

// ---------------------------------------------------------------------------
// LlmAnalyzer class
// ---------------------------------------------------------------------------

/**
 * Produces a full `IRequestAnalysis` using an LLM provider.
 * Uses `IOutputValidator.validate()` with `RequestAnalysisSchema` to parse
 * the LLM's JSON response, and returns a safe fallback on any failure.
 */
export class LlmAnalyzer {
  constructor(
    private readonly provider: IModelProvider,
    private readonly validator: IOutputValidator,
  ) {}

  async analyze(
    requestText: string,
    context?: IRequestAnalysisContext,
  ): Promise<IRequestAnalysis> {
    const startMs = Date.now();
    const prompt = buildPrompt(requestText, context);

    let raw: string;
    try {
      raw = await this.provider.generate(prompt, { temperature: 0, max_tokens: 1500 });
    } catch {
      const fallback = buildFallback(requestText);
      fallback.metadata.durationMs = Date.now() - startMs;
      return fallback;
    }

    const result = this.validator.validate<IRequestAnalysis>(raw, RequestAnalysisSchema);
    const durationMs = Date.now() - startMs;

    if (result.success && result.value) {
      return {
        ...result.value,
        metadata: {
          ...result.value.metadata,
          analyzedAt: result.value.metadata.analyzedAt || new Date().toISOString(),
          durationMs,
          mode: AnalysisMode.LLM,
        },
      };
    }

    const fallback = buildFallback(requestText);
    fallback.metadata.durationMs = durationMs;
    return fallback;
  }
}
