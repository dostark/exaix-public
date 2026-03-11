/**
 * @module RequestAnalysisSchema
 * @path src/shared/schemas/request_analysis.ts
 * @description Defines Zod validation schemas and inferred TypeScript types for
 * structured request intent analysis output produced by the RequestAnalyzer
 * service (Phase 45). Captures goals, requirements, constraints, acceptance
 * criteria, ambiguities, and actionability metadata extracted from raw request
 * text.
 * @architectural-layer Shared
 * @dependencies [zod]
 * @related-files [src/services/request_analysis/request_analyzer.ts, src/shared/schemas/mod.ts]
 */

import { z } from "zod";

// ============================================================================
// Enums
// ============================================================================

/**
 * Complexity classification for a request.
 */
export enum RequestAnalysisComplexity {
  /** Short, clear, single-concern requests (< 200 chars, ≤ 2 bullets, ≤ 1 file). */
  SIMPLE = "simple",
  /** Standard multi-step requests (default). */
  MEDIUM = "medium",
  /** Multi-file, multi-requirement, lengthy requests (> 10 bullets or > 5 files). */
  COMPLEX = "complex",
  /** Multi-phase or cross-service initiatives (multi-phase keywords detected). */
  EPIC = "epic",
}

/**
 * Task type classification derived from action verbs in request text.
 */
export enum RequestTaskType {
  FEATURE = "feature",
  BUGFIX = "bugfix",
  REFACTOR = "refactor",
  TEST = "test",
  DOCS = "docs",
  ANALYSIS = "analysis",
  UNKNOWN = "unknown",
}

/**
 * Impact level of an identified ambiguity.
 */
export enum AmbiguityImpact {
  /** Ambiguity is unlikely to affect the outcome. */
  LOW = "low",
  /** Ambiguity may affect quality or completeness. */
  MEDIUM = "medium",
  /** Ambiguity could lead to a wrong implementation entirely. */
  HIGH = "high",
}

/**
 * Which analysis strategy produced this result.
 */
export enum AnalyzerMode {
  HEURISTIC = "heuristic",
  LLM = "llm",
  HYBRID = "hybrid",
}

// ============================================================================
// Sub-schemas
// ============================================================================

/**
 * A single goal extracted from the request.
 */
export const RequestGoalSchema = z.object({
  /** Human-readable goal description. */
  description: z.string().min(1),
  /** True if the goal was stated explicitly; false if inferred. */
  explicit: z.boolean(),
  /**
   * Priority rank (1 = highest). Used to weight evaluation criteria.
   * Must be a positive integer.
   */
  priority: z.number().int().min(1),
});

export type IRequestGoal = z.infer<typeof RequestGoalSchema>;

/**
 * A concrete requirement extracted from the request.
 */
export const RequirementSchema = z.object({
  /** Human-readable requirement description. */
  description: z.string().min(1),
  /**
   * Analyzer confidence that this is a genuine requirement (0.0–1.0).
   * Lower values indicate inferred or ambiguous requirements.
   */
  confidence: z.number().min(0).max(1),
});

export type IRequirement = z.infer<typeof RequirementSchema>;

/**
 * An identified ambiguity or gap in the request specification.
 */
export const AmbiguitySchema = z.object({
  /** Description of what is ambiguous or unclear. */
  description: z.string().min(1),
  /** Estimated impact if this ambiguity is not resolved. */
  impact: z.nativeEnum(AmbiguityImpact),
});

export type IAmbiguity = z.infer<typeof AmbiguitySchema>;

/**
 * Analysis metadata — timing, mode, and version information.
 */
export const RequestAnalysisMetadataSchema = z.object({
  /** ISO 8601 timestamp when analysis was performed. */
  analyzedAt: z.string().datetime(),
  /** Wall-clock time taken to produce this analysis, in milliseconds. */
  durationMs: z.number().nonnegative(),
  /** Analysis strategy that produced this result. */
  mode: z.nativeEnum(AnalyzerMode),
});

export type IRequestAnalysisMetadata = z.infer<typeof RequestAnalysisMetadataSchema>;

// ============================================================================
// Root schema
// ============================================================================

/**
 * Full structured analysis of a request, produced by RequestAnalyzer.
 */
export const RequestAnalysisSchema = z.object({
  /** Ordered list of goals extracted from the request. */
  goals: z.array(RequestGoalSchema),

  /** Concrete requirements inferred or stated in the request. */
  requirements: z.array(RequirementSchema),

  /**
   * Constraints imposed by the request (e.g., "no new dependencies",
   * "must work on Node 18").
   */
  constraints: z.array(z.string()),

  /**
   * Explicit acceptance criteria extracted from the request body or
   * frontmatter. Each item is a plain-text condition that must be satisfied.
   */
  acceptanceCriteria: z.array(z.string()),

  /** Identified ambiguities or underspecified areas. */
  ambiguities: z.array(AmbiguitySchema),

  /**
   * Overall actionability score (0–100).
   * 0 = completely vague/unactionable; 100 = fully specified, ready to execute.
   */
  actionabilityScore: z.number().int().min(0).max(100),

  /** Estimated implementation complexity. */
  complexity: z.nativeEnum(RequestAnalysisComplexity),

  /** Primary task type derived from action verbs. */
  taskType: z.nativeEnum(RequestTaskType),

  /** Keywords / tags identifying topic areas (used to populate IParsedRequest.tags). */
  tags: z.array(z.string()),

  /** Source file paths explicitly mentioned in the request text. */
  referencedFiles: z.array(z.string()),

  /** Analysis timing and strategy metadata. */
  metadata: RequestAnalysisMetadataSchema,
});

export type IRequestAnalysis = z.infer<typeof RequestAnalysisSchema>;
