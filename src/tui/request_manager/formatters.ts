/**
 * Formatting utilities for Request Manager View
 * Extracted from request_manager_view.ts to reduce complexity
 */

import { TUI_DETAIL_DATE_LOCALE, TUI_LABEL_REQUEST_DETAILS, TUI_MSG_PRESS_QUIT } from "../../config/constants.ts";
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
      `║${TUI_LABEL_REQUEST_DETAILS.padStart(30 + TUI_LABEL_REQUEST_DETAILS.length / 2).padEnd(60)}║`,
      `╠══════════════════════════════════════════════════════════════╣`,
      `║ ID:       ${request.trace_id.padEnd(50)}║`,
      `║ Title:    ${request.title.padEnd(50)}║`,
      `║ Status:   ${request.status.padEnd(50)}║`,
      `║ Priority: ${request.priority.padEnd(50)}║`,
      `║ Agent:    ${request.agent.padEnd(50)}║`,
      `║ Created:  ${new Date(request.created).toLocaleString(TUI_DETAIL_DATE_LOCALE).padEnd(50)}║`,
      `║ Creator:  ${request.created_by.padEnd(50)}║`,
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
      lines.push(`║   Explicit: ${request.skills.explicit.join(", ").slice(0, 46).padEnd(46)} ║`);
    }
    if (request.skills.autoMatched && request.skills.autoMatched.length > 0) {
      lines.push(`║   Auto-matched: ${request.skills.autoMatched.join(", ").slice(0, 42).padEnd(42)} ║`);
    }
    if (request.skills.fromDefaults && request.skills.fromDefaults.length > 0) {
      lines.push(`║   From defaults: ${request.skills.fromDefaults.join(", ").slice(0, 41).padEnd(41)} ║`);
    }
    if (request.skills.skipped && request.skills.skipped.length > 0) {
      lines.push(`║   Skipped: ${request.skills.skipped.join(", ").slice(0, 47).padEnd(47)} ║`);
    }
    if (
      !request.skills.explicit?.length && !request.skills.autoMatched?.length &&
      !request.skills.fromDefaults?.length
    ) {
      lines.push(`║   (none)                                                     ║`);
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
      lines.push(`║ ${line.slice(0, 60).padEnd(60)}║`);
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
