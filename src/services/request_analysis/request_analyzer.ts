/**
 * @module RequestAnalyzer
 * @path src/services/request_analysis/request_analyzer.ts
 * @description Orchestrator service for request intent analysis. Implements
 * `IRequestAnalyzerService` and delegates to the heuristic strategy, the
 * `LlmAnalyzer`, or both (hybrid mode) based on the supplied configuration.
 *
 * Hybrid mode runs heuristic first; escalates to LLM only when the heuristic
 * actionability score falls below `actionabilityThreshold`. File references
 * detected by the heuristic are merged into LLM results to ensure they are
 * never lost. Activity is logged to the database journal when a `db` instance
 * is provided.
 * @architectural-layer Services
 * @dependencies [src/services/request_analysis/heuristic_analyzer.ts, src/services/request_analysis/llm_analyzer.ts, src/shared/schemas/request_analysis.ts, src/shared/interfaces/i_request_analyzer_service.ts, src/shared/interfaces/i_database_service.ts]
 * @related-files [src/services/request_analysis/mod.ts, src/services/request_processor.ts]
 */

import type { IModelProvider } from "../../ai/types.ts";
import type { IOutputValidator } from "../output_validator.ts";
import type { IDatabaseService } from "../../shared/interfaces/i_database_service.ts";
import type {
  IRequestAnalysisContext,
  IRequestAnalyzerConfig,
  IRequestAnalyzerService,
} from "../../shared/interfaces/i_request_analyzer_service.ts";
import {
  AnalyzerMode,
  type IRequestAnalysis,
  RequestAnalysisComplexity,
  RequestTaskType,
} from "../../shared/schemas/request_analysis.ts";
import { analyzeHeuristic } from "./heuristic_analyzer.ts";
import { LlmAnalyzer } from "./llm_analyzer.ts";
import { DEFAULT_ACTIONABILITY_THRESHOLD } from "../../shared/constants.ts";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Derive an actionability score from a partial heuristic result.
 * Uses ambiguity count and complexity as a proxy (no real score from heuristic).
 */
function heuristicActionabilityScore(partial: Partial<IRequestAnalysis>): number {
  let score = 70; // baseline
  const ambiguities = partial.ambiguities ?? [];
  score -= ambiguities.length * 10;
  if (partial.complexity === RequestAnalysisComplexity.SIMPLE) score += 20;
  if (partial.complexity === RequestAnalysisComplexity.EPIC) score -= 20;
  return Math.max(0, Math.min(100, score));
}

/**
 * Merge heuristic file references into an LLM result, deduplicating by value.
 */
function mergeFileRefs(base: IRequestAnalysis, heuristic: Partial<IRequestAnalysis>): IRequestAnalysis {
  const heuristicFiles = heuristic.referencedFiles ?? [];
  if (heuristicFiles.length === 0) return base;
  const merged = [...new Set([...base.referencedFiles, ...heuristicFiles])];
  return { ...base, referencedFiles: merged };
}

/**
 * Build a complete `IRequestAnalysis` from a partial heuristic result.
 * Fills all required fields with safe defaults so the result is always valid.
 */
function completeFromHeuristic(
  partial: Partial<IRequestAnalysis>,
  requestText: string,
  durationMs: number,
): IRequestAnalysis {
  return {
    goals: partial.goals ?? [],
    requirements: partial.requirements ?? [],
    constraints: partial.constraints ?? [],
    acceptanceCriteria: partial.acceptanceCriteria ?? [],
    ambiguities: partial.ambiguities ?? [],
    actionabilityScore: heuristicActionabilityScore(partial),
    complexity: partial.complexity ??
      (requestText.trim().length <= 200 ? RequestAnalysisComplexity.SIMPLE : RequestAnalysisComplexity.MEDIUM),
    taskType: partial.taskType ?? RequestTaskType.UNKNOWN,
    tags: partial.tags ?? [],
    referencedFiles: partial.referencedFiles ?? [],
    metadata: {
      analyzedAt: new Date().toISOString(),
      durationMs,
      mode: AnalyzerMode.HEURISTIC,
    },
  };
}

// ---------------------------------------------------------------------------
// RequestAnalyzer
// ---------------------------------------------------------------------------

/**
 * Orchestrates heuristic and LLM analysis strategies to produce structured
 * request intent analysis.
 */
export class RequestAnalyzer implements IRequestAnalyzerService {
  private readonly threshold: number;
  private readonly llmAnalyzer: LlmAnalyzer | null;

  constructor(
    private readonly config: IRequestAnalyzerConfig,
    private readonly provider?: IModelProvider,
    private readonly validator?: IOutputValidator,
    private readonly db?: Pick<IDatabaseService, "logActivity">,
  ) {
    this.threshold = config.actionabilityThreshold ?? DEFAULT_ACTIONABILITY_THRESHOLD;
    this.llmAnalyzer = provider && validator ? new LlmAnalyzer(provider, validator) : null;
  }

  async analyze(
    requestText: string,
    context?: IRequestAnalysisContext,
  ): Promise<IRequestAnalysis> {
    const startMs = Date.now();
    const mode = this.config.mode;

    let result: IRequestAnalysis;

    if (mode === "heuristic") {
      const partial = analyzeHeuristic(requestText);
      result = completeFromHeuristic(partial, requestText, Date.now() - startMs);
    } else if (mode === "llm") {
      result = await this._callLlmWithFallback(requestText, context, startMs);
      // Always merge heuristic file refs into LLM result
      const heuristicPartial = analyzeHeuristic(requestText);
      result = mergeFileRefs(result, heuristicPartial);
    } else {
      // hybrid
      const heuristicPartial = analyzeHeuristic(requestText);
      const hScore = heuristicActionabilityScore(heuristicPartial);

      if (hScore >= this.threshold || !this.llmAnalyzer) {
        result = completeFromHeuristic(heuristicPartial, requestText, Date.now() - startMs);
      } else {
        try {
          const llmResult = await this.llmAnalyzer.analyze(requestText, context);
          result = mergeFileRefs(llmResult, heuristicPartial);
        } catch {
          result = completeFromHeuristic(heuristicPartial, requestText, Date.now() - startMs);
        }
      }
    }

    // Stamp final timing
    result = {
      ...result,
      metadata: {
        ...result.metadata,
        durationMs: Date.now() - startMs,
      },
    };

    this._logActivity(requestText, result);
    return result;
  }

  /**
   * Fast synchronous-style analysis (no LLM, regardless of mode).
   */
  analyzeQuick(requestText: string): Partial<IRequestAnalysis> {
    if (!requestText || requestText.trim().length === 0) {
      return { referencedFiles: [], tags: [], ambiguities: [], constraints: [] };
    }
    return analyzeHeuristic(requestText);
  }

  // -------------------------------------------------------------------------
  // Private helpers
  // -------------------------------------------------------------------------

  private async _callLlmWithFallback(
    requestText: string,
    context: IRequestAnalysisContext | undefined,
    startMs: number,
  ): Promise<IRequestAnalysis> {
    if (!this.llmAnalyzer) {
      const partial = analyzeHeuristic(requestText);
      return completeFromHeuristic(partial, requestText, Date.now() - startMs);
    }
    try {
      return await this.llmAnalyzer.analyze(requestText, context);
    } catch {
      const partial = analyzeHeuristic(requestText);
      return completeFromHeuristic(partial, requestText, Date.now() - startMs);
    }
  }

  private _logActivity(requestText: string, result: IRequestAnalysis): void {
    if (!this.db) return;
    try {
      this.db.logActivity(
        "RequestAnalyzer",
        "request.analyzed",
        null,
        {
          mode: result.metadata.mode,
          complexity: result.complexity,
          taskType: result.taskType,
          actionabilityScore: result.actionabilityScore,
          durationMs: result.metadata.durationMs,
          requestLength: requestText.length,
        },
      );
    } catch {
      // Non-fatal — analysis result is already produced
    }
  }
}
