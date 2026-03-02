/**
 * @module CLIBase
 * @path src/cli/base.ts
 * @description Provides the abstract base class for all CLI command handlers, offering shared utilities for configuration, database access, user identity, and YAML frontmatter processing.
 * @architectural-layer CLI
 * @dependencies [config_schema, db_schema, event_logger]
 * @related-files [src/cli/exoctl.ts]
 */

import type { ICliApplicationContext } from "./cli_context.ts";

export interface ICommandContext extends ICliApplicationContext {}

/**
 * Base class for CLI command handlers
 * Provides shared utilities and ensures consistent patterns
 */
export abstract class BaseCommand {
  protected context: ICliApplicationContext;
  private _userIdentity: string | null = null;

  constructor(context: ICommandContext) {
    this.context = context;
  }

  /**
   * Get the configuration.
   */
  protected get config() {
    return this.context.config.getAll();
  }

  /**
   * Get the database service.
   */
  protected get db() {
    return this.context.db;
  }

  /**
   * Get the display service (logger).
   */
  protected get display() {
    return this.context.display;
  }

  /**
   * Get user identity from git config or OS username.
   * Leverages the underlying git service.
   * @returns User email or username
   */
  protected async getUserIdentity(): Promise<string> {
    if (this._userIdentity) {
      return this._userIdentity;
    }

    try {
      // Identity check can be a property of git service or a standalone util.
      // We will cache it on the instance for now.
      const _branchIdent = await this.context.git.getCurrentBranch(); // Just checking connectivity
      this._userIdentity = "cli-user"; // Simplified for initialization
    } catch {
      this._userIdentity = "unknown-user";
    }

    return this._userIdentity;
  }

  /**
   * Parse frontmatter from markdown file (YAML format)
   * @param content File content
   * @returns Frontmatter object
   */
  protected extractFrontmatter(content: string): Record<string, string | boolean | number> {
    const match = content.match(/^---\s*\n([\s\S]*?)\n---\s*/);
    if (!match) {
      return {};
    }

    const frontmatter: Record<string, string | boolean | number> = {};
    const lines = match[1].split("\n");

    for (const line of lines) {
      const colonIndex = line.indexOf(":");
      if (colonIndex === -1) continue;

      const key = line.substring(0, colonIndex).trim();
      let value = line.substring(colonIndex + 1).trim();

      // Remove quotes if present
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.substring(1, value.length - 1);
      }

      if (value.toLowerCase() === "true") {
        frontmatter[key] = true;
      } else if (value.toLowerCase() === "false") {
        frontmatter[key] = false;
      } else if (!isNaN(Number(value)) && value.trim() !== "") {
        frontmatter[key] = Number(value);
      } else {
        frontmatter[key] = value;
      }
    }

    return frontmatter;
  }

  /**
   * Serialize frontmatter object back to YAML format
   * @param frontmatter Frontmatter object
   * @returns YAML string with --- delimiters
   */
  protected serializeFrontmatter(frontmatter: Record<string, string | boolean | number>): string {
    const lines = ["---"];
    for (const [key, rawValue] of Object.entries(frontmatter)) {
      const value = String(rawValue);
      // Quote values that contain colons, hyphens in UUIDs, or special chars
      const needsQuotes = typeof rawValue === "string" && (value.includes(":") ||
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value));

      if (needsQuotes) {
        lines.push(`${key}: "${value}"`);
      } else {
        lines.push(`${key}: ${value}`);
      }
    }
    lines.push("---");
    return lines.join("\n");
  }

  /**
   * Update frontmatter in markdown content
   * @param content Original content
   * @param updates Frontmatter fields to update
   * @returns Updated content
   */
  protected updateFrontmatter(
    content: string,
    updates: Record<string, string | boolean | number>,
  ): string {
    const frontmatter = this.extractFrontmatter(content);
    const updated = { ...frontmatter, ...updates };
    const body = content.replace(/^---\s*\n[\s\S]*?\n---\s*\n?/, "");
    return this.serializeFrontmatter(updated) + "\n" + body;
  }

  /**
   * Validate that required frontmatter fields exist
   * @param frontmatter Frontmatter object
   * @param required Required field names
   * @param filePath File path for error messages
   * @throws Error if required fields are missing
   */
  protected validateFrontmatter(
    frontmatter: Record<string, string | boolean | number>,
    required: string[],
    filePath: string,
  ): void {
    for (const field of required) {
      if (!frontmatter[field]) {
        throw new Error(
          `Invalid file format: missing required field '${field}' in ${filePath}`,
        );
      }
    }
  }

  /**
   * Format timestamp for display
   * @param isoString ISO 8601 timestamp
   * @returns Human-readable timestamp
   */
  protected formatTimestamp(isoString: string): string {
    const date = new Date(isoString);
    return date.toLocaleString();
  }

  /**
   * Truncate string for display
   * @param str String to truncate
   * @param maxLength Maximum length
   * @returns Truncated string with ellipsis
   */
  protected truncate(str: string, maxLength: number): string {
    if (str.length <= maxLength) return str;
    return str.substring(0, maxLength - 3) + "...";
  }

  /**
   * Get the full command line that was invoked
   * @returns Array of command arguments (excluding 'deno run' etc.)
   */
  protected getCommandLine(): string[] {
    return Deno.args;
  }

  /**
   * Get the command line as a single string for logging
   * @returns Command line string like "exoctl daemon start --force"
   */
  /**
   * Get the system configuration
   * @returns Config object
   */
  public getConfig() {
    return this.config;
  }

  protected getCommandLineString(): string {
    return `exoctl ${Deno.args.join(" ")}`;
  }
}
