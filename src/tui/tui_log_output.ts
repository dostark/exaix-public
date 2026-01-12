/**
 * TuiLogOutput - StructuredLogger output for TUI integration
 *
 * Part of Phase 13.6: StructuredLogger TUI Integration
 *
 * This output feeds log entries to the StructuredLoggerService for real-time
 * display in the TUI StructuredLogViewer component.
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
