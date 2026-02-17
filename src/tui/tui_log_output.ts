/**
 * @module TuiLogOutput
 * @path src/tui/tui_log_output.ts
 * @description Implementation of StructuredLogger output that feeds entries to the TUI service for real-time display.
 * @architectural-layer TUI
 * @dependencies [structured_logger, structured_log_service]
 * @related-files [src/tui/structured_log_viewer.ts]
 */

import type { LogEntry, LogOutput } from "../services/structured_logger.ts";
import type { StructuredLoggerService } from "./structured_log_service.ts";

/**
 * LogOutput implementation that feeds entries to StructuredLoggerService
 */
export class TuiLogOutput implements LogOutput {
  constructor(private logService: StructuredLoggerService) {}

  write(entry: LogEntry): void {
    this.logService.addLogEntry(entry);
  }
}

/**
 * Factory function to create TuiLogOutput
 */
export function createTuiLogOutput(logService: StructuredLoggerService): TuiLogOutput {
  return new TuiLogOutput(logService);
}
