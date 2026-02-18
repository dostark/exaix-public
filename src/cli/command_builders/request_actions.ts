/**
 * @module RequestActionBuilders
 * @path src/cli/command_builders/request_actions.ts
 * @description Provides builders and helper functions for defining request-related CLI actions and subcommands.
 * @architectural-layer CLI
 * @dependencies [request_commands, base_command]
 * @related-files [src/cli/exoctl.ts, src/cli/request_commands.ts]
 */

import type { RequestCommands } from "../commands/request_commands.ts";
import { RequestPriority } from "../../enums.ts";
import { PRIORITY_ICONS } from "../cli.config.ts";

export interface RequestActionContext {
  requestCommands: RequestCommands;
  display: any;
}

/**
 * Handle request create action
 */
export async function handleRequestCreate(
  context: RequestActionContext,
  options: any,
  description?: string,
): Promise<void> {
  const { requestCommands, display } = context;

  try {
    // Handle file input
    if (options.file) {
      const result = await requestCommands.createFromFile(options.file, {
        agent: options.flow ? undefined : options.agent,
        priority: options.priority as RequestPriority,
        portal: options.portal,
        target_branch: options.targetBranch,
        model: options.model,
        flow: options.flow,
        skills: options.skills ? options.skills.split(",").map((s: string) => s.trim()) : undefined,
      });
      printRequestResult(context, result, !!options.json, !!options.dryRun);
      return;
    }

    // Require description for inline mode
    if (!description) {
      display.error("cli.error", "request", {
        message: 'Description required. Usage: exoctl request "<description>" or use --file',
      });
      Deno.exit(1);
    }

    // Create request
    const result = await requestCommands.create(description, {
      agent: options.flow ? undefined : options.agent,
      priority: options.priority as RequestPriority,
      portal: options.portal,
      target_branch: options.targetBranch,
      model: options.model,
      flow: options.flow,
      skills: options.skills ? options.skills.split(",").map((s: string) => s.trim()) : undefined,
    });

    if (options.dryRun) {
      display.info("cli.dry_run", "request", { would_create: result.filename });
      return;
    }

    printRequestResult(context, result, !!options.json, false);
  } catch (error) {
    display.error("cli.error", "request", { message: error instanceof Error ? error.message : "Unknown error" });
    Deno.exit(1);
  }
}

/**
 * Handle request list action
 */
export async function handleRequestList(
  context: RequestActionContext,
  options: any,
): Promise<void> {
  const { requestCommands, display } = context;

  try {
    const requests = await requestCommands.list(options.status);
    if (options.json) {
      display.info("cli.output", "requests", { data: JSON.stringify(requests, null, 2) });
    } else {
      if (requests.length === 0) {
        display.info("request.list", "requests", { count: 0, message: "No requests found" });
        return;
      }
      display.info("request.list", "requests", { count: requests.length });
      for (const req of requests) {
        const priorityIcon = PRIORITY_ICONS[req.priority] || PRIORITY_ICONS.default;
        display.info(`${priorityIcon} ${req.trace_id.slice(0, 8)}`, req.trace_id, {
          status: req.status,
          agent: req.flow ? undefined : req.agent,
          flow: req.flow,
          target_branch: req.target_branch,
          created: `${req.created_by} @ ${req.created}`,
        });
      }
    }
  } catch (error) {
    display.error("cli.error", "request list", {
      message: error instanceof Error ? error.message : "Unknown error",
    });
    Deno.exit(1);
  }
}

/**
 * Handle request show action
 */
export async function handleRequestShow(
  context: RequestActionContext,
  id: string,
): Promise<void> {
  const { requestCommands, display } = context;

  try {
    const { metadata, content } = await requestCommands.show(id);
    const displayData: Record<string, unknown> = {
      trace_id: metadata.trace_id,
      status: metadata.status,
      priority: metadata.priority,
      agent: metadata.flow ? undefined : metadata.agent,
      flow: metadata.flow,
      target_branch: metadata.target_branch,
      created: `${metadata.created_by} @ ${metadata.created}`,
    };

    if (metadata.input_tokens !== undefined) {
      displayData.input_tokens = metadata.input_tokens;
    }
    if (metadata.output_tokens !== undefined) {
      displayData.output_tokens = metadata.output_tokens;
    }
    if (metadata.total_tokens !== undefined) {
      displayData.total_tokens = metadata.total_tokens;
    }
    if (metadata.token_provider !== undefined) {
      displayData.token_provider = metadata.token_provider;
    }
    if (metadata.token_model !== undefined) {
      displayData.token_model = metadata.token_model;
    }
    if (metadata.token_cost_usd !== undefined) {
      displayData.token_cost_usd = metadata.token_cost_usd;
    }
    if (metadata.error !== undefined) {
      displayData.error = metadata.error;
    }

    display.info("request.show", metadata.trace_id.slice(0, 8), displayData);
    display.info("request.content", id, { content });
  } catch (error) {
    display.error("cli.error", "request show", {
      message: error instanceof Error ? error.message : "Unknown error",
    });
    Deno.exit(1);
  }
}

/**
 * Print request result (helper function)
 */
function printRequestResult(
  context: RequestActionContext,
  result: any,
  json: boolean,
  _dryRun: boolean,
): void {
  const { display } = context;

  if (json) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    const priorityIcon = PRIORITY_ICONS[result.priority] || PRIORITY_ICONS.default;
    display.info("request.created", result.trace_id.slice(0, 8), {
      trace_id: result.trace_id,
      filename: result.filename,
      priority: `${priorityIcon} ${result.priority}`,
      agent: result.flow ? undefined : result.agent,
      flow: result.flow,
      status: result.status,
    });
  }
}
