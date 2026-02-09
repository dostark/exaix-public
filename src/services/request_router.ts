import { FlowRunner } from "../flows/flow_runner.ts";
import { AgentRunner, type Blueprint, type ParsedRequest } from "./agent_runner.ts";
import { EventLogger } from "./event_logger.ts";
import { BlueprintLoader } from "./blueprint_loader.ts";
import { WorkspaceExecutionContext, WorkspaceExecutionContextBuilder } from "./workspace_execution_context.ts";
import type { Config } from "../config/schema.ts";
import { PORTAL_CONTEXT_KEY } from "../config/constants.ts";
import { buildPortalContextBlock } from "./prompt_context.ts";

/**
 * RequestRouter - Routes requests to appropriate execution engine
 * Implements Step 7.6 of the ExoFrame Implementation Plan
 *
 * Routing Priority:
 * 1. flow: <id> → FlowRunner (multi-agent)
 * 2. agent: <id> → AgentRunner (single-agent)
 * 3. Neither → Default agent
 */

export interface RoutingDecision {
  type: "flow" | "agent";
  flowId?: string;
  agentId?: string;
  result: any;
}

export class RoutingError extends Error {
  constructor(message: string, public readonly requestId?: string) {
    super(message);
    this.name = "RoutingError";
  }
}

export interface FlowValidator {
  validateFlow(flowId: string): Promise<{ valid: boolean; error?: string }>;
}

/**
 * RequestRouter handles routing decisions for incoming requests
 */
export class RequestRouter {
  constructor(
    private flowRunner: FlowRunner,
    private agentRunner: AgentRunner,
    private flowValidator: FlowValidator,
    private eventLogger: EventLogger,
    private defaultAgentId: string,
    private blueprintsPath: string,
    private config: Config,
  ) {}

  /**
   * Build execution context based on request portal parameter
   */
  buildExecutionContext(request: {
    frontmatter: Record<string, any>;
  }): WorkspaceExecutionContext {
    const portalAlias = request.frontmatter.portal;

    // If portal specified, create portal context
    if (portalAlias) {
      // Find portal in config
      const portal = this.config.portals.find((p) => p.alias === portalAlias);

      if (!portal) {
        throw new Error(`Portal '${portalAlias}' not found`);
      }

      // Build portal context using the portal config
      // Note: We need to convert PortalConfig to PortalPermissions format
      const portalPermissions = {
        alias: portal.alias,
        target_path: portal.target_path,
        created: portal.created,
        operations: [],
        agents_allowed: ["*"],
      };

      return WorkspaceExecutionContextBuilder.forPortal(portalPermissions as any);
    }

    // Otherwise, create workspace context
    return WorkspaceExecutionContextBuilder.forWorkspace(
      this.config.system.root,
    );
  }

  /**
   * Route a request to the appropriate execution engine
   */
  async route(request: {
    traceId: string;
    requestId: string;
    frontmatter: Record<string, any>;
    body: string;
  }): Promise<RoutingDecision> {
    const { traceId, requestId, frontmatter } = request;
    const flowId = frontmatter.flow;
    const agentId = frontmatter.agent;

    // Check for conflicting fields
    if (flowId && agentId) {
      await this.eventLogger.log({
        action: "request.routing.error",
        target: requestId,
        payload: {
          error: "Request cannot specify both 'flow' and 'agent' fields",
          field: "conflict",
          value: `${flowId}/${agentId}`,
        },
        traceId,
      });
      throw new RoutingError(
        "Request cannot specify both 'flow' and 'agent' fields",
        requestId,
      );
    }

    // Route to flow if specified
    if (flowId) {
      return await this.routeToFlow(flowId, request);
    }

    // Route to agent if specified
    if (agentId) {
      return await this.routeToAgent(agentId, request);
    }

    // Route to default agent
    return await this.routeToDefaultAgent(request);
  }

  private async routeToFlow(flowId: string, request: any): Promise<RoutingDecision> {
    const { traceId, requestId } = request;

    // Log routing decision
    await this.eventLogger.log({
      action: "request.routing.flow",
      target: requestId,
      payload: { flowId },
      traceId,
    });

    // Validate flow
    const validation = await this.flowValidator.validateFlow(flowId);
    if (!validation.valid) {
      await this.eventLogger.log({
        action: "request.flow.validation.failed",
        target: flowId,
        payload: { error: validation.error },
        traceId,
      });
      throw new RoutingError(validation.error!, requestId);
    }

    // Log successful validation
    await this.eventLogger.log({
      action: "request.flow.validated",
      target: flowId,
      payload: {},
      traceId,
    });

    // Execute flow
    const result = await this.flowRunner.execute(
      { id: flowId } as any, // Flow object will be loaded by FlowRunner
      {
        userPrompt: request.body,
        traceId,
        requestId,
      },
    );

    return {
      type: "flow",
      flowId,
      result,
    };
  }

  private async routeToAgent(agentId: string, request: any): Promise<RoutingDecision> {
    const { traceId, requestId, body } = request;

    // Log routing decision
    await this.eventLogger.log({
      action: "request.routing.agent",
      target: requestId,
      payload: { agentId },
      traceId,
    });

    // Load blueprint
    const blueprint = await this.loadBlueprint(agentId);
    if (!blueprint) {
      throw new RoutingError(`Agent blueprint not found: ${agentId}`, requestId);
    }

    // Create parsed request
    const parsedRequest: ParsedRequest = {
      userPrompt: body,
      context: {},
      traceId,
      requestId,
    };
    const portalContext = this.buildPortalContext(request.frontmatter?.portal);
    if (portalContext) {
      parsedRequest.context[PORTAL_CONTEXT_KEY] = portalContext;
    }

    // Execute agent
    const result = await this.agentRunner.run(blueprint, parsedRequest);

    return {
      type: "agent",
      agentId,
      result,
    };
  }

  private async routeToDefaultAgent(request: any): Promise<RoutingDecision> {
    const { traceId, requestId } = request;

    // Log routing decision
    await this.eventLogger.log({
      action: "request.routing.default",
      target: requestId,
      payload: { defaultAgentId: this.defaultAgentId },
      traceId,
    });

    // Load default blueprint
    const blueprint = await this.loadBlueprint(this.defaultAgentId);
    if (!blueprint) {
      throw new RoutingError(`Default agent blueprint not found: ${this.defaultAgentId}`, requestId);
    }

    // Create parsed request
    const parsedRequest: ParsedRequest = {
      userPrompt: request.body,
      context: {},
      traceId,
      requestId,
    };
    const portalContext = this.buildPortalContext(request.frontmatter?.portal);
    if (portalContext) {
      parsedRequest.context[PORTAL_CONTEXT_KEY] = portalContext;
    }

    // Execute default agent
    const result = await this.agentRunner.run(blueprint, parsedRequest);

    return {
      type: "agent",
      agentId: this.defaultAgentId,
      result,
    };
  }

  /**
   * Load an agent blueprint from the blueprints directory
   * Uses unified BlueprintLoader for consistent parsing
   */
  protected async loadBlueprint(agentId: string): Promise<Blueprint | null> {
    const loader = new BlueprintLoader({ blueprintsPath: this.blueprintsPath });
    const loaded = await loader.load(agentId);
    if (!loaded) {
      return null;
    }
    return loader.toLegacyBlueprint(loaded);
  }

  private buildPortalContext(portalAlias?: string): string | null {
    if (!portalAlias) return null;

    const portal = this.config.portals.find((p) => p.alias === portalAlias);
    if (!portal) {
      return null;
    }

    return buildPortalContextBlock({
      portalAlias,
      portalRoot: portal.target_path,
    });
  }
}
