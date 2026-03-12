import { FlowInputSource, FlowOutputFormat } from "../../src/shared/enums.ts";
/**
 * @module Feature_Development.Flow
 * @path Blueprints/Flows/feature_development.flow.ts
 * @description Module for feature_development.flow.
 */

import { defineFlow } from "../../src/flows/define_flow.ts";

export default defineFlow({
  id: "feature-development",
  name: "Feature Development Flow",
  description: "End-to-end feature development from requirements to implementation",
  version: "1.0.0",
  defaultSkills: ["typescript-patterns"],
  steps: [
    {
      id: "analyze-requirements",
      name: "Analyze Requirements",
      agent: "product-manager",
      dependsOn: [],
      input: {
        source: FlowInputSource.REQUEST,
        transform: "passthrough",
      },
      retry: {
        maxAttempts: 1,
        backoffMs: 1000,
      },
    },
    {
      id: "design-architecture",
      name: "Design Architecture",
      agent: "software-architect",
      dependsOn: ["analyze-requirements"],
      input: {
        source: FlowInputSource.STEP,
        stepId: "analyze-requirements",
        transform: "extract-technical-requirements",
      },
      retry: {
        maxAttempts: 1,
        backoffMs: 1000,
      },
    },
    {
      id: "implement-feature",
      name: "Implement Feature",
      agent: "senior-coder",
      dependsOn: ["design-architecture"],
      input: {
        source: FlowInputSource.STEP,
        stepId: "design-architecture",
        transform: "extract-implementation-plan",
      },
      timeout: 60000,
      retry: {
        maxAttempts: 1,
        backoffMs: 1000,
      },
    },
    {
      id: "write-tests",
      name: "Write Unit Tests",
      agent: "test-engineer",
      dependsOn: ["implement-feature"],
      input: {
        source: FlowInputSource.STEP,
        stepId: "implement-feature",
        transform: "extract-test-requirements",
      },
      retry: {
        maxAttempts: 1,
        backoffMs: 1000,
      },
    },
    {
      id: "code-review",
      name: "Code Review",
      agent: "senior-coder",
      dependsOn: ["implement-feature", "write-tests"],
      input: {
        source: FlowInputSource.AGGREGATE,
        transform: "combine-implementation-and-tests",
      },
      retry: {
        maxAttempts: 1,
        backoffMs: 1000,
      },
    },
    {
      id: "integration-test",
      name: "Integration Testing",
      agent: "qa-engineer",
      dependsOn: ["code-review"],
      input: {
        source: FlowInputSource.STEP,
        stepId: "code-review",
        transform: "prepare-integration-test",
      },
      retry: {
        maxAttempts: 1,
        backoffMs: 1000,
      },
    },
  ],
  output: {
    from: ["code-review", "integration-test"],
    format: FlowOutputFormat.JSON,
  },
  settings: {
    maxParallelism: 3,
    failFast: true,
    timeout: 600000,
  },
});
