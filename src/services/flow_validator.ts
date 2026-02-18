/**
 * @module FlowValidator
 * @path src/services/flow_validator.ts
 * @description Validates flow definitions, including structure, dependencies, and agent references.
 * @architectural-layer Services
 * @dependencies [FlowLoader, DependencyResolver, RequestRouter]
 * @related-files [src/flows/flow_loader.ts, src/services/request_router.ts]
 */
import { FlowLoader } from "../flows/flow_loader.ts";
import { DependencyResolver } from "../flows/dependency_resolver.ts";
import type { FlowValidator } from "./request_router.ts";
import type { Flow, FlowStep } from "../schemas/flow.ts";

/**
 * FlowValidatorImpl - Validates flow definitions before execution
 * Implements comprehensive validation for flow-aware request routing
 */
export class FlowValidatorImpl implements FlowValidator {
  constructor(
    private flowLoader: FlowLoader,
    private blueprintsPath: string,
  ) {}

  /**
   * Validate a flow by ID
   */
  async validateFlow(flowId: string): Promise<{ valid: boolean; error?: string }> {
    try {
      const exists = await this.flowLoader.flowExists(flowId);
      if (!exists) {
        return { valid: false, error: `Flow '${flowId}' not found` };
      }

      const loadResult = await this.tryLoadFlow(flowId);
      if (loadResult.error) return { valid: false, error: loadResult.error };
      const flow = loadResult.flow;

      const structureError = this.validateStructure(flowId, flow);
      if (structureError) return { valid: false, error: structureError };

      const dependencyError = this.validateDependencies(flowId, flow.steps);
      if (dependencyError) return { valid: false, error: dependencyError };

      const agentError = this.validateStepAgents(flowId, flow.steps);
      if (agentError) return { valid: false, error: agentError };

      const outputError = this.validateOutput(flowId, flow);
      if (outputError) return { valid: false, error: outputError };

      return { valid: true };
    } catch (error) {
      return {
        valid: false,
        error: `Flow '${flowId}' validation failed: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  private async tryLoadFlow(
    flowId: string,
  ): Promise<{ flow: Awaited<ReturnType<FlowLoader["loadFlow"]>>; error?: string }> {
    try {
      const flow = await this.flowLoader.loadFlow(flowId);
      return { flow };
    } catch (loaderErr) {
      const msg = loaderErr instanceof Error ? loaderErr.message : String(loaderErr);
      if (msg.includes("Agent reference cannot be empty")) {
        return { flow: undefined as unknown as Flow, error: `Flow '${flowId}' has invalid agent` };
      }
      return { flow: undefined as unknown as Flow, error: `Flow '${flowId}' validation failed: ${msg}` };
    }
  }

  private validateStructure(flowId: string, flow: Flow): string | null {
    if (!flow.steps || flow.steps.length === 0) {
      return `Flow '${flowId}' must contain at least one step`;
    }
    return null;
  }

  private validateDependencies(flowId: string, steps: FlowStep[]): string | null {
    const resolver = new DependencyResolver(steps);
    try {
      resolver.topologicalSort();
      return null;
    } catch (error) {
      return `Flow '${flowId}' has invalid dependencies: ${error instanceof Error ? error.message : String(error)}`;
    }
  }

  private validateStepAgents(flowId: string, steps: FlowStep[]): string | null {
    for (const step of steps) {
      if (!step.agent || typeof step.agent !== "string" || step.agent === "") {
        return `Flow '${flowId}' step '${step.id}' has invalid agent: ${step.agent}`;
      }
    }
    return null;
  }

  private validateOutput(flowId: string, flow: Flow): string | null {
    if (!flow.output) return null;
    if (!flow.output.from || !flow.output.format) {
      return `Flow '${flowId}' has invalid output configuration`;
    }

    const outputFrom = flow.output.from;
    const stepIds = new Set(flow.steps.map((s) => s.id));

    if (typeof outputFrom === "string") {
      if (stepIds.has(outputFrom)) return null;
      return `Flow '${flowId}' output.from references non-existent step: ${outputFrom}`;
    }

    if (Array.isArray(outputFrom)) {
      for (const stepId of outputFrom) {
        if (!stepIds.has(stepId)) {
          return `Flow '${flowId}' output.from references non-existent step: ${stepId}`;
        }
      }
      return null;
    }

    return `Flow '${flowId}' has invalid output configuration`;
  }
}
