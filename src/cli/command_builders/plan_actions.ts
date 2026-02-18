/**
 * @module PlanActionBuilders
 * @path src/cli/command_builders/plan_actions.ts
 * @description Provides builders and helper functions for defining plan-related CLI actions and subcommands.
 * @architectural-layer CLI
 * @dependencies [plan_commands, base_command]
 * @related-files [src/cli/exoctl.ts, src/cli/plan_commands.ts]
 */

import type { PlanCommands } from "../commands/plan_commands.ts";

export interface PlanActionContext {
  planCommands: PlanCommands;
  display: any;
}

/**
 * Handle plan list action
 */
export async function handlePlanList(
  context: PlanActionContext,
  options: any,
): Promise<void> {
  const { planCommands, display } = context;

  try {
    const plans = await planCommands.list(options.status);
    if (plans.length === 0) {
      display.info("plan.list", "plans", { count: 0, message: "No plans found" });
      return;
    }
    display.info("plan.list", "plans", { count: plans.length });
    for (const plan of plans) {
      const statusIcon = plan.status === "review" ? "🔍" : "⚠️";
      const displayData: Record<string, unknown> = {
        status: plan.status,
        trace: plan.trace_id ? `${plan.trace_id.substring(0, 8)}...` : undefined,
      };

      // Add request information if available
      if (plan.request_title) {
        displayData.request = plan.request_title.length > 50
          ? `${plan.request_title.substring(0, 47)}...`
          : plan.request_title;
      }
      if (plan.request_agent) {
        displayData.agent = plan.request_agent;
      }
      if (plan.request_portal) {
        displayData.portal = plan.request_portal;
      }
      if (plan.request_priority) {
        displayData.priority = plan.request_priority;
      }

      display.info(`${statusIcon} ${plan.id}`, plan.id, displayData);
    }
  } catch (error) {
    display.error("cli.error", "plan list", {
      message: error instanceof Error ? error.message : "Unknown error",
    });
    Deno.exit(1);
  }
}

/**
 * Handle plan show action
 */
export async function handlePlanShow(
  context: PlanActionContext,
  id: string,
): Promise<void> {
  const { planCommands, display } = context;

  try {
    const plan = await planCommands.show(id);
    const displayData: Record<string, unknown> = {
      status: plan.status,
      trace: plan.trace_id,
    };

    // Add request information if available
    if (plan.request_id) {
      displayData.request = plan.request_id;
    }
    if (plan.request_title) {
      displayData.title = plan.request_title;
    }
    if (plan.request_agent) {
      displayData.agent = plan.request_agent;
    }
    if (plan.request_portal) {
      displayData.portal = plan.request_portal;
    }
    if (plan.request_priority) {
      displayData.priority = plan.request_priority;
    }
    if (plan.request_created_by) {
      displayData.created_by = plan.request_created_by;
    }
    if (plan.input_tokens !== undefined) {
      displayData.input_tokens = plan.input_tokens;
    }
    if (plan.output_tokens !== undefined) {
      displayData.output_tokens = plan.output_tokens;
    }
    if (plan.total_tokens !== undefined) {
      displayData.total_tokens = plan.total_tokens;
    }
    if (plan.token_provider !== undefined) {
      displayData.token_provider = plan.token_provider;
    }
    if (plan.token_model !== undefined) {
      displayData.token_model = plan.token_model;
    }
    if (plan.token_cost_usd !== undefined) {
      displayData.token_cost_usd = plan.token_cost_usd;
    }

    display.info("plan.show", plan.id, displayData);
    display.info("plan.content", id, { content: plan.content });
  } catch (error) {
    display.error("cli.error", "plan show", {
      message: error instanceof Error ? error.message : "Unknown error",
    });
    Deno.exit(1);
  }
}

/**
 * Handle plan approve action
 */
export async function handlePlanApprove(
  context: PlanActionContext,
  id: string,
  options: any,
): Promise<void> {
  const { planCommands, display } = context;

  try {
    await planCommands.approve(
      id,
      options.skills ? options.skills.split(",").map((s: string) => s.trim()) : undefined,
    );
  } catch (error) {
    display.error("cli.error", "plan approve", {
      message: error instanceof Error ? error.message : "Unknown error",
    });
    Deno.exit(1);
  }
}

/**
 * Handle plan reject action
 */
export async function handlePlanReject(
  context: PlanActionContext,
  id: string,
  reason: string,
): Promise<void> {
  const { planCommands, display } = context;

  try {
    await planCommands.reject(id, reason);
  } catch (error) {
    display.error("cli.error", "plan reject", {
      message: error instanceof Error ? error.message : "Unknown error",
    });
    Deno.exit(1);
  }
}

/**
 * Handle plan revise action
 */
export async function handlePlanRevise(
  context: PlanActionContext,
  id: string,
  comments: string[],
): Promise<void> {
  const { planCommands, display } = context;

  try {
    await planCommands.revise(id, comments);
  } catch (error) {
    display.error("cli.error", "plan revise", {
      message: error instanceof Error ? error.message : "Unknown error",
    });
    Deno.exit(1);
  }
}
