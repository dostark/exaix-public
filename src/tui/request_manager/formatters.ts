/**
 * Formatting utilities for Request Manager View
 * Extracted from request_manager_view.ts to reduce complexity
 */

import {
  TUI_DETAIL_DATE_LOCALE,
  TUI_LABEL_REQUEST_DETAILS,
  TUI_LAYOUT_MEDIUM_WIDTH,
  TUI_LAYOUT_VALUE_WIDTH,
  TUI_MSG_PRESS_QUIT,
} from "../../config/constants.ts";
import type { Request } from "../request_manager_view.ts";

/**
 * Formatter for Request Manager View
 */
export class RequestFormatter {
  /**
   * Format request metadata section
   */
  static formatRequestMetadata(request: Request): string[] {
    return [
      `╔══════════════════════════════════════════════════════════════╗`,
      `║${
        TUI_LABEL_REQUEST_DETAILS.padStart(TUI_LAYOUT_MEDIUM_WIDTH / 2 + TUI_LABEL_REQUEST_DETAILS.length / 2).padEnd(
          TUI_LAYOUT_MEDIUM_WIDTH,
        )
      }║`,
      `╠══════════════════════════════════════════════════════════════╣`,
      `║ ID:       ${request.trace_id.padEnd(TUI_LAYOUT_VALUE_WIDTH)}║`,
      `║ Title:    ${request.title.padEnd(TUI_LAYOUT_VALUE_WIDTH)}║`,
      `║ Status:   ${request.status.padEnd(TUI_LAYOUT_VALUE_WIDTH)}║`,
      `║ Priority: ${request.priority.padEnd(TUI_LAYOUT_VALUE_WIDTH)}║`,
      `║ Agent:    ${request.agent.padEnd(TUI_LAYOUT_VALUE_WIDTH)}║`,
      `║ Created:  ${new Date(request.created).toLocaleString(TUI_DETAIL_DATE_LOCALE).padEnd(TUI_LAYOUT_VALUE_WIDTH)}║`,
      `║ Creator:  ${request.created_by.padEnd(TUI_LAYOUT_VALUE_WIDTH)}║`,
    ];
  }

  /**
   * Format skills section if present
   */
  static formatSkillsSection(request: Request): string[] {
    if (!request.skills) return [];

    const lines: string[] = [
      `╠══════════════════════════════════════════════════════════════╣`,
      `║ Applied Skills:                                              ║`,
    ];

    if (request.skills.explicit && request.skills.explicit.length > 0) {
      const explicitStr = request.skills.explicit.join(", ");
      const limit = TUI_LAYOUT_MEDIUM_WIDTH - 14;
      lines.push(`║   Explicit: ${explicitStr.slice(0, limit).padEnd(limit)} ║`);
    }
    if (request.skills.autoMatched && request.skills.autoMatched.length > 0) {
      const autoStr = request.skills.autoMatched.join(", ");
      const limit = TUI_LAYOUT_MEDIUM_WIDTH - 18;
      lines.push(`║   Auto-matched: ${autoStr.slice(0, limit).padEnd(limit)} ║`);
    }
    if (request.skills.fromDefaults && request.skills.fromDefaults.length > 0) {
      const defStr = request.skills.fromDefaults.join(", ");
      const limit = TUI_LAYOUT_MEDIUM_WIDTH - 19;
      lines.push(`║   From defaults: ${defStr.slice(0, limit).padEnd(limit)} ║`);
    }
    if (request.skills.skipped && request.skills.skipped.length > 0) {
      const skipStr = request.skills.skipped.join(", ");
      const limit = TUI_LAYOUT_MEDIUM_WIDTH - 13;
      lines.push(`║   Skipped: ${skipStr.slice(0, limit).padEnd(limit)} ║`);
    }
    if (
      !request.skills.explicit?.length && !request.skills.autoMatched?.length &&
      !request.skills.fromDefaults?.length
    ) {
      lines.push(`║   (none)`.padEnd(TUI_LAYOUT_MEDIUM_WIDTH + 1) + `║`);
    }

    return lines;
  }

  /**
   * Format content section
   */
  static formatContentSection(content: string): string[] {
    const lines: string[] = [
      `╠══════════════════════════════════════════════════════════════╣`,
      `║ Content:                                                     ║`,
      `╠══════════════════════════════════════════════════════════════╣`,
    ];

    const contentLines = content.split("\n");
    for (const line of contentLines) {
      lines.push(`║ ${line.slice(0, TUI_LAYOUT_MEDIUM_WIDTH).padEnd(TUI_LAYOUT_MEDIUM_WIDTH)}║`);
    }

    return lines;
  }

  /**
   * Format complete request detail content
   */
  static formatDetailContent(request: Request | undefined, content: string): string {
    if (!request) return content;

    const lines: string[] = [
      ...this.formatRequestMetadata(request),
      ...this.formatSkillsSection(request),
      ...this.formatContentSection(content),
      `╚══════════════════════════════════════════════════════════════╝`,
      "",
      TUI_MSG_PRESS_QUIT,
    ];

    return lines.join("\n");
  }
}
