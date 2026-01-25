import { BaseCommand, type CommandContext } from "../base.ts";
import { Table } from "@cliffy/table";
import * as colors from "@std/fmt/colors";
import type { ActivityRecord, JournalFilterOptions } from "../../services/db.ts";

export interface JournalCommandOptions {
  filter?: string[];
  tail?: number;
  format?: "json" | "table" | "text";
  distinct?: string;
  count?: boolean;
  payload?: string;
  actor?: string;
  target?: string;
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

    if (options.distinct) {
      filterOptions.distinct = options.distinct;
    }

    if (options.count) {
      filterOptions.count = true;
    }

    if (options.payload) {
      filterOptions.payload = options.payload;
    }

    if (options.actor) {
      filterOptions.actor = options.actor;
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
              colors.yellow(
                `Unknown filter key: ${key}. Supported: trace_id, action_type, agent_id, since, payload, actor, target.`,
              ),
            );
        }
      }
    }

    // Execute query
    const results = await db.queryActivity(filterOptions);

    // Format output
    if (options.format === "json") {
      console.log(JSON.stringify(results, null, 2));
    } else if (options.format === "table") {
      this.renderTable(results, filterOptions);
    } else {
      // Default: text format
      this.renderText(results, filterOptions);
    }
  }

  private renderTable(activities: ActivityRecord[], filter: JournalFilterOptions) {
    if (activities.length === 0) {
      console.log(colors.gray("No activities found."));
      return;
    }

    // Handle different query types
    if (filter.distinct) {
      // DISTINCT query - show the distinct field values
      const table = new Table()
        .header([colors.bold(filter.distinct)])
        .body(
          activities.map((a) => [a[filter.distinct as keyof ActivityRecord] || ""]),
        );
      table.render();
      return;
    }

    if (filter.count) {
      // COUNT query - show action_type and count
      const table = new Table()
        .header([
          colors.bold("Action Type"),
          colors.bold("Count"),
        ])
        .body(
          activities.map((a) => [
            a.action_type,
            String(a.count || 0),
          ]),
        );
      table.render();
      return;
    }

    // Standard activity records
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

  private renderText(activities: ActivityRecord[], filter: JournalFilterOptions) {
    if (activities.length === 0) {
      console.log(colors.gray("No activities found."));
      return;
    }

    // Handle different query types
    if (filter.distinct) {
      // DISTINCT query - show the distinct field values
      for (const activity of activities) {
        const value = activity[filter.distinct as keyof ActivityRecord] || "";
        console.log(value);
      }
      return;
    }

    if (filter.count) {
      // COUNT query - show action_type and count
      for (const activity of activities) {
        console.log(`${activity.action_type}: ${activity.count || 0}`);
      }
      return;
    }

    // Standard activity records
    for (const activity of activities) {
      const timestamp = new Date(activity.timestamp).toLocaleString();
      const traceId = activity.trace_id.slice(0, 8);
      const agent = activity.agent_id || activity.actor || "-";

      // Color code action
      let action = activity.action_type;
      if (action.includes("error") || action.includes("fail") || action.includes("reject")) {
        action = colors.red(action);
      } else if (action.includes("approve") || action.includes("success")) {
        action = colors.green(action);
      } else if (action.includes("create") || action.includes("start")) {
        action = colors.blue(action);
      }

      console.log(
        `${colors.gray(timestamp)} ${action} ${colors.dim("agent=")}${agent} ${colors.dim("trace=")}${
          colors.gray(traceId)
        } ${colors.dim("target=")}${activity.target || "-"}`,
      );
    }
  }
}
