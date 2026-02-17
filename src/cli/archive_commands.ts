/**
 * @module ArchiveCommands
 * @path src/cli/archive_commands.ts
 * @description Provides CLI commands for interacting with the execution archive, including listing, showing details, and searching by date or agent.
 * @architectural-layer CLI
 * @dependencies [base_command, archive_service]
 * @related-files [src/services/archive_service.ts, src/cli/main.ts]
 */

import { BaseCommand, type CommandContext } from "./base.ts";
import { ArchiveService } from "../services/archive_service.ts";

export class ArchiveCommands extends BaseCommand {
  private archiveService: ArchiveService;

  constructor(context: CommandContext) {
    super(context);
    this.archiveService = new ArchiveService(this.config.paths.archive);
  }

  async list(): Promise<void> {
    const index = await this.archiveService.searchByDateRange("0000-01-01T00:00:00Z", "9999-12-31T23:59:59Z");
    for (const entry of index) {
      console.log(`${entry.archived_at} | ${entry.trace_id} | ${entry.agent_id} | ${entry.status}`);
    }
  }

  async show(traceId: string): Promise<void> {
    const entry = await this.archiveService.getByTraceId(traceId);
    if (!entry) {
      console.error(`No archive entry found for trace_id: ${traceId}`);
      return;
    }
    console.log(JSON.stringify(entry, null, 2));
  }

  async search(query: string): Promise<void> {
    // For demo: search by agent_id
    const results = await this.archiveService.searchByAgent(query);
    for (const entry of results) {
      console.log(`${entry.archived_at} | ${entry.trace_id} | ${entry.agent_id} | ${entry.status}`);
    }
  }

  async stats(): Promise<void> {
    const index = await this.archiveService.searchByDateRange("0000-01-01T00:00:00Z", "9999-12-31T23:59:59Z");
    const total = index.length;
    const byStatus = index.reduce((acc, e) => {
      acc[e.status] = (acc[e.status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    console.log(`Total: ${total}`);
    for (const [status, count] of Object.entries(byStatus)) {
      console.log(`${status}: ${count}`);
    }
  }
}
