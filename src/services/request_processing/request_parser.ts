import { parse as parseYaml } from "@std/yaml";
import { exists } from "@std/fs";
import type { EventLogger } from "../event_logger.ts";
import type { ParsedRequestFile, RequestFrontmatter } from "./types.ts";
import { coerceRequestStatus } from "../../requests/request_status.ts";

export class RequestParser {
  constructor(private readonly logger: EventLogger) {}

  /**
   * Parse a request file and extract frontmatter and body
   */
  async parse(filePath: string): Promise<ParsedRequestFile | null> {
    // Check file exists
    if (!await exists(filePath)) {
      await this.logger.error("file.not_found", filePath, {});
      return null;
    }

    try {
      const content = await Deno.readTextFile(filePath);

      // Extract YAML frontmatter between --- delimiters
      const yamlMatch = content.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
      if (!yamlMatch) {
        await this.logger.error("frontmatter.invalid", filePath, {
          error: "Missing or malformed --- delimiters",
        });
        return null;
      }

      const yamlContent = yamlMatch[1];
      const body = yamlMatch[2] || "";

      // Parse YAML
      const frontmatter = parseYaml(yamlContent) as unknown as RequestFrontmatter;

      // Normalize status to canonical set (guards against malformed/unknown values)
      frontmatter.status = coerceRequestStatus(frontmatter.status);

      // Validate required fields
      if (!frontmatter.trace_id) {
        await this.logger.error("frontmatter.missing_trace_id", filePath, {});
        return null;
      }

      return {
        frontmatter,
        body,
        rawContent: content,
      };
    } catch (error) {
      await this.logger.error("file.parse_failed", filePath, {
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }
}
