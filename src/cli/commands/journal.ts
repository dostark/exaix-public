import { BaseCommand, type CommandContext } from "../base.ts";
import * as colors from "@std/fmt/colors";
import type { JournalFilterOptions } from "../../services/db.ts";
import { JournalFormatter } from "../formatters/journal_formatter.ts";

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
    const filterOptions = this.parseFilterOptions(options);

    // Execute query
    const results = await db.queryActivity(filterOptions);

    // Format output
    JournalFormatter.render(results, filterOptions, options.format);
  }

  private parseFilterOptions(options: JournalCommandOptions): JournalFilterOptions {
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
    return filterOptions;
  }
}
