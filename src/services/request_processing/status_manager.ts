import type { EventLogger } from "../event_logger.ts";

export class StatusManager {
  constructor(private readonly logger: EventLogger) {}

  /**
   * Update the status field in a request file's YAML frontmatter
   */
  async updateStatus(
    filePath: string,
    originalContent: string,
    newStatus: string,
  ): Promise<void> {
    try {
      // Replace the status field in the YAML frontmatter
      const updatedContent = originalContent.replace(
        /^(status:\s*).+$/m,
        `$1${newStatus}`,
      );

      await Deno.writeTextFile(filePath, updatedContent);
    } catch (error) {
      await this.logger.error("request.status_update_failed", filePath, {
        new_status: newStatus,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}
