/**
 * @module RequestActionBuilders
 * @path src/cli/command_builders/request_actions.ts
 * @description Provides builders and helper functions for defining request-related CLI actions and subcommands.
 * @architectural-layer CLI
 * @dependencies [request_commands, base_command]
 * @related-files [src/cli/exoctl.ts, src/cli/request_commands.ts]
 */

import type { RequestCommands } from "../commands/request_commands.ts";
import { RequestPriority } from "../../shared/enums.ts";
import { RequestStatus } from "../../shared/status/request_status.ts";
import { PRIORITY_ICONS } from "../cli.config.ts";
import type { EventLogger } from "../../services/event_logger.ts";
import { JSONObject, JSONValue, toSafeJson } from "../../shared/types/json.ts";

export interface IRequestActionContext {
  requestCommands: RequestCommands;
  display: EventLogger;
}

export interface RequestCreateOptions {
  file?: string;
  agent?: string;
  priority?: string | RequestPriority;
  portal?: string;
  targetBranch?: string;
  model?: string;
  flow?: string;
  skills?: string;
  subject?: string;
  json?: boolean;
  dryRun?: boolean;
}

export interface RequestListOptions {
  status?: RequestStatus;
  all?: boolean;
  json?: boolean;
}

/**
 * Handle request create action
 */
export async function handleRequestCreate(
  context: IRequestActionContext,
  options: RequestCreateOptions,
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
        subject: options.subject,
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
      subject: options.subject,
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
  context: IRequestActionContext,
  options: RequestListOptions,
): Promise<void> {
  const { requestCommands, display } = context;

  try {
    const requests = await requestCommands.list(options.status, options.all);
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
        const subjectTag = req.subject ? `[${req.subject}] ` : "";
        display.info(
          `${priorityIcon} ${subjectTag}${req.trace_id.slice(0, 8)}`,
          req.trace_id,
          toSafeJson({
            status: req.status,
            subject: req.subject,
            agent: req.flow ? undefined : req.agent,
            flow: req.flow,
            target_branch: req.target_branch,
            created: `${req.created_by} @ ${req.created}`,
          }) as Record<string, JSONValue>,
        );
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
  context: IRequestActionContext,
  id: string,
): Promise<void> {
  const { requestCommands, display } = context;

  try {
    const { metadata, content } = await requestCommands.show(id);
    const displayData: JSONObject = {
      trace_id: metadata.trace_id,
      status: metadata.status,
      subject: metadata.subject,
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

    display.info("request.show", metadata.trace_id.slice(0, 8), toSafeJson(displayData) as Record<string, JSONValue>);
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
  context: IRequestActionContext,
  result: {
    priority: RequestPriority;
    trace_id: string;
    filename: string;
    agent?: string;
    flow?: string;
    status: string;
    subject?: string;
  },
  json: boolean,
  _dryRun: boolean,
): void {
  const { display } = context;

  if (json) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    const priorityIcon = PRIORITY_ICONS[result.priority] || PRIORITY_ICONS.default;
    display.info(
      "request.created",
      result.trace_id.slice(0, 8),
      toSafeJson({
        trace_id: result.trace_id,
        filename: result.filename,
        priority: `${priorityIcon} ${result.priority}`,
        subject: result.subject,
        agent: result.flow ? undefined : result.agent,
        flow: result.flow,
        status: result.status,
      }) as Record<string, JSONValue>,
    );
  }
}
