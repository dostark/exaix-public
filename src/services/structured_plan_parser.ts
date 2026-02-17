/**
 * @module StructuredPlanParser
 * @path src/services/structured_plan_parser.ts
 * @description Shared utility for detecting and parsing structured plans from markdown content,
 * specifically extracting execution steps and metadata.
 * @architectural-layer Services
 * @dependencies []
 * @related-files [src/services/execution_loop.ts, src/services/plan_writer.ts]
 */

export interface StructuredPlanFrontmatter {
  trace_id: string;
  request_id: string;
  agent_id?: string;
}

export interface StructuredPlanStep {
  number: number;
  title: string;
  content: string;
}

export interface StructuredPlan {
  trace_id: string;
  request_id: string;
  agent: string;
  steps: StructuredPlanStep[];
}

/**
 * Detect and parse structured plans with an "Execution Steps" section.
 *
 * Looks for:
 * - "## Execution Steps" header
 * - One or more step headers: "## Step N: Title"
 */
export function parseStructuredPlanFromMarkdown(
  planContent: string,
  frontmatter: StructuredPlanFrontmatter,
): StructuredPlan | null {
  const stepRegex = /^## Step (\d+): (.+)$/gm;
  const executionStepsRegex = /^## Execution Steps$/m;

  if (!executionStepsRegex.test(planContent)) return null;

  const matches = [...planContent.matchAll(stepRegex)];
  if (matches.length === 0) return null;

  const steps: StructuredPlanStep[] = [];

  for (let i = 0; i < matches.length; i++) {
    const match = matches[i];
    const stepNumber = Number.parseInt(match[1], 10);
    const title = match[2];

    const startIndex = (match.index ?? 0) + match[0].length;
    const endIndex = i < matches.length - 1 ? (matches[i + 1].index ?? planContent.length) : planContent.length;

    const content = planContent.substring(startIndex, endIndex).trim();

    steps.push({
      number: stepNumber,
      title,
      content,
    });
  }

  return {
    trace_id: frontmatter.trace_id,
    request_id: frontmatter.request_id,
    agent: frontmatter.agent_id || "unknown",
    steps,
  };
}
