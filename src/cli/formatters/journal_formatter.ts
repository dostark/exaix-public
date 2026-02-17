/**
 * @module JournalFormatter
 * @path src/cli/formatters/journal_formatter.ts
 * @description Provides formatting and rendering logic for Activity Journal records in the CLI, supporting table, text, and JSON outputs.
 * @architectural-layer CLI
 * @dependencies [table, colors, db_schema]
 * @related-files [src/cli/commands/journal.ts]
 */

import { Table } from "@cliffy/table";
import * as colors from "@std/fmt/colors";
import type { ActivityRecord, JournalFilterOptions } from "../../services/db.ts";

export class JournalFormatter {
  static render(
    activities: ActivityRecord[],
    filter: JournalFilterOptions,
    format: "json" | "table" | "text" = "text",
  ): void {
    if (format === "json") {
      console.log(JSON.stringify(activities, null, 2));
      return;
    }

    if (activities.length === 0) {
      console.log(colors.gray("No activities found."));
      return;
    }

    if (format === "table") {
      this.renderTable(activities, filter);
    } else {
      this.renderText(activities, filter);
    }
  }

  private static renderTable(activities: ActivityRecord[], filter: JournalFilterOptions) {
    // Handle different query types
    if (filter.distinct) {
      // DISTINCT query - show the distinct field values
      const table = new Table()
        .header([colors.bold(filter.distinct)])
        .body(
          activities.map((a) => [String(a[filter.distinct as keyof ActivityRecord] || "")]),
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
          const action = this.styleAction(a.action_type);

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

  private static renderText(activities: ActivityRecord[], filter: JournalFilterOptions) {
    // Handle different query types
    if (filter.distinct) {
      this.renderDistinctText(activities, filter.distinct);
      return;
    }

    if (filter.count) {
      this.renderCountText(activities);
      return;
    }

    // Standard activity records
    for (const activity of activities) {
      const timestamp = new Date(activity.timestamp).toLocaleString();
      const traceId = activity.trace_id.slice(0, 8);
      const agent = activity.agent_id || activity.actor || "-";

      // Color code action
      const action = this.styleAction(activity.action_type);

      console.log(
        `${colors.gray(timestamp)} ${action} ${colors.dim("agent=")}${agent} ${colors.dim("trace=")}${
          colors.gray(traceId)
        } ${colors.dim("target=")}${activity.target || "-"}`,
      );
    }
  }

  private static renderDistinctText(activities: ActivityRecord[], distinctField: string) {
    for (const activity of activities) {
      const value = activity[distinctField as keyof ActivityRecord] || "";
      console.log(value);
    }
  }

  private static renderCountText(activities: ActivityRecord[]) {
    for (const activity of activities) {
      console.log(`${activity.action_type}: ${activity.count || 0}`);
    }
  }

  private static styleAction(action: string): string {
    if (action.includes("error") || action.includes("fail") || action.includes("reject")) {
      return colors.red(action);
    }
    if (action.includes("approve") || action.includes("success")) {
      return colors.green(action);
    }
    if (action.includes("create") || action.includes("start")) {
      return colors.blue(action);
    }
    return action;
  }

  private static truncateText(str: string, max: number): string {
    return str.length > max ? str.slice(0, max - 3) + "..." : str;
  }
}
