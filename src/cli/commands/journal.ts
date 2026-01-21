import { BaseCommand, type CommandContext } from "../base.ts";
import { Table } from "@cliffy/table";
import * as colors from "@std/fmt/colors";
import type { ActivityRecord, JournalFilterOptions } from "../../services/db.ts";

export interface JournalCommandOptions {
  filter?: string[];
  tail?: number;
  format?: "json" | "table";
}

/**
 * JournalCommands provides CLI access to the Activity Journal.
 */
export class JournalCommands extends BaseCommand {
  constructor(context: CommandContext) {
    super(context);
  }

  /**
   * Query and display journal activities
   */
  async show(options: JournalCommandOptions): Promise<void> {
    const { db } = this;

    // Parse filters
    const filterOptions: JournalFilterOptions = {};

    if (options.tail) {
      filterOptions.limit = options.tail;
    }

    if (options.filter) {
      // Normalize filter to always be an array (Cliffy sometimes returns string for single value)
      const filters = Array.isArray(options.filter) ? options.filter : [options.filter];

      for (const filter of filters) {
        // Ensure filter is a string
        const filterStr = typeof filter === "string" ? filter : String(filter);
        const [key, value] = filterStr.split("=");
        if (!key || !value) {
          console.error(colors.red(`Invalid filter format: ${filterStr}. Use key=value.`));
          Deno.exit(1);
        }

        switch (key) {
          case "trace_id":
            filterOptions.traceId = value;
            break;
          case "action_type":
            filterOptions.actionType = value;
            break;
          case "agent_id":
            filterOptions.agentId = value;
            break;
          case "time": // Alias for since
          case "since":
            filterOptions.since = value;
            break;
          default:
            console.error(
              colors.yellow(`Unknown filter key: ${key}. Supported: trace_id, action_type, agent_id, since.`),
            );
        }
      }
    }

    // Execute query
    const results = await db.queryActivity(filterOptions);

    // Format output
    if (options.format === "json") {
      console.log(JSON.stringify(results, null, 2));
    } else {
      this.renderTable(results);
    }
  }

  private renderTable(activities: ActivityRecord[]) {
    if (activities.length === 0) {
      console.log(colors.gray("No activities found."));
      return;
    }

    const table = new Table()
      .header([
        colors.bold("Timestamp"),
        colors.bold("Action"),
        colors.bold("Agent"),
        colors.bold("Trace ID"),
        colors.bold("Target"),
      ])
      .body(
        activities.map((a) => {
          const timestamp = new Date(a.timestamp).toLocaleString();
          let action = a.action_type;

          // Color code actions
          if (action.includes("error") || action.includes("fail") || action.includes("reject")) {
            action = colors.red(action);
          } else if (action.includes("approve") || action.includes("success")) {
            action = colors.green(action);
          } else if (action.includes("create") || action.includes("start")) {
            action = colors.blue(action);
          }

          return [
            colors.gray(timestamp),
            action,
            a.agent_id || a.actor || "-",
            colors.gray(a.trace_id.slice(0, 8)), // Truncate trace ID
            this.truncateText(a.target || "-", 30),
          ];
        }),
      )
      .border(true);

    table.render();
  }

  private truncateText(str: string, max: number): string {
    return str.length > max ? str.slice(0, max - 3) + "..." : str;
  }
}
