/**
 * @module Code_Review.Flow
 * @path Blueprints/Flows/code_review.flow.ts
 * @description Module for code_review.flow.
 */

import { defineFlow } from "../../src/flows/define_flow.ts";
import { DEFAULT_FLOW_VERSION } from '../../src/shared/constants.ts';
import { FlowInputSource, FlowOutputFormat } from "../../src/shared/enums.ts";

export default defineFlow({
  id: "code-review",
  name: "Code Review Flow",
  description: "Automated code review workflow with multiple agents",
  version: DEFAULT_FLOW_VERSION,
  defaultSkills: ["code-review"],
  steps: [
    {
      id: "analyze-code",
      name: "Analyze Codebase",
      agent: "senior-coder",
      dependsOn: [],
      input: {
        source: FlowInputSource.REQUEST,
        transform: "passthrough",
      },
      retry: {
        maxAttempts: 2,
        backoffMs: 1000,
      },
    },
    {
      id: "security-review",
      name: "Security Analysis",
      agent: "security-expert",
      dependsOn: ["analyze-code"],
      input: {
        source: FlowInputSource.STEP,
        stepId: "analyze-code",
        transform: "extract-security-focus",
      },
      timeout: 30000,
      retry: {
        maxAttempts: 1,
        backoffMs: 1000,
      },
    },
    {
      id: "performance-review",
      name: "Performance Review",
      agent: "performance-engineer",
      dependsOn: ["analyze-code"],
      input: {
        source: FlowInputSource.STEP,
        stepId: "analyze-code",
        transform: "extract-performance-focus",
      },
      timeout: 30000,
      retry: {
        maxAttempts: 1,
        backoffMs: 1000,
      },
    },
    {
      id: "final-report",
      name: "Generate Final Report",
      agent: "technical-writer",
      dependsOn: ["security-review", "performance-review"],
      input: {
        source: FlowInputSource.AGGREGATE,
        transform: "combine-reviews",
      },
      condition: "results.every(r => r.status === 'completed')",
      retry: {
        maxAttempts: 1,
        backoffMs: 1000,
      },
    },
  ],
  output: {
    from: "final-report",
    format: FlowOutputFormat.MARKDOWN,
  },
  settings: {
    maxParallelism: 2,
    failFast: false,
    timeout: 300000,
  },
});
