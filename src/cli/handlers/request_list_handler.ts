/**
 * @module RequestListHandler
 * @path src/cli/handlers/request_list_handler.ts
 * @description Handles listing and filtering agent requests from the workspace inbox, including status coercion and sorting.
 * @architectural-layer CLI
 * @dependencies [path, fs, base_command, request_commands, request_status, request_paths]
 * @related-files [src/cli/request_commands.ts, src/schemas/request.ts]
 */

import { join } from "@std/path";
import { exists } from "@std/fs";
import { BaseCommand, type ICommandContext } from "../base.ts";
import { type IRequestEntry } from "../commands/request_commands.ts";
import { coerceRequestStatus, type RequestStatusType } from "../../requests/request_status.ts";
import { getWorkspaceArchiveDir, getWorkspaceRejectedDir, getWorkspaceRequestsDir } from "./request_paths.ts";

export class RequestListHandler extends BaseCommand {
  private workspaceRequestsDir: string;
  private context: ICommandContext;

  constructor(context: ICommandContext) {
    super(context);
    this.context = context;
    this.workspaceRequestsDir = getWorkspaceRequestsDir(context);
  }

  async list(status?: RequestStatusType, includeArchived?: boolean): Promise<IRequestEntry[]> {
    const dirsToScan = this.getDirectoriesToScan(includeArchived);
    const requests = await this.scanDirectories(dirsToScan, status);

    // Sort by created date descending (newest first)
    requests.sort((a, b) => {
      const dateA = new Date(a.created).getTime();
      const dateB = new Date(b.created).getTime();
      return dateB - dateA;
    });

    return requests;
  }

  private getDirectoriesToScan(includeArchived?: boolean): string[] {
    const dirs = [this.workspaceRequestsDir];
    if (includeArchived) {
      dirs.push(getWorkspaceArchiveDir(this.context));
      dirs.push(getWorkspaceRejectedDir(this.context));
    }
    return dirs;
  }

  private async scanDirectories(dirs: string[], statusFilter?: RequestStatusType): Promise<IRequestEntry[]> {
    const requests: IRequestEntry[] = [];
    for (const dir of dirs) {
      if (!await exists(dir)) continue;

      for await (const entry of Deno.readDir(dir)) {
        if (!entry.isFile || !entry.name.endsWith(".md") || entry.name.includes("_plan")) {
          continue;
        }

        const entryResult = await this.processRequestEntry(dir, entry.name, statusFilter);
        if (entryResult) {
          requests.push(entryResult);
        }
      }
    }
    return requests;
  }

  private async processRequestEntry(
    dir: string,
    filename: string,
    statusFilter?: RequestStatusType,
  ): Promise<IRequestEntry | null> {
    const filePath = join(dir, filename);
    try {
      const content = await Deno.readTextFile(filePath);
      const frontmatter = this.extractFrontmatter(content);
      const parsedStatus = coerceRequestStatus(String(frontmatter.status || ""));

      if (statusFilter && parsedStatus !== statusFilter) {
        return null;
      }

      return this.mapFrontmatterToRequestEntry(filename, filePath, frontmatter, parsedStatus);
    } catch (error) {
      console.warn(`Failed to read request file ${filePath}:`, error);
      return null;
    }
  }

  private mapFrontmatterToRequestEntry(
    filename: string,
    filePath: string,
    frontmatter: Record<string, string | boolean | number>,
    status: RequestStatusType,
  ): IRequestEntry {
    const entry: any = {
      filename: filename,
      path: filePath,
      status: status,
    };

    const fields = [
      { key: "trace_id", fallback: "" },
      { key: "priority", fallback: "normal" },
      { key: "agent", fallback: "default" },
      { key: "created", fallback: "" },
      { key: "created_by", fallback: "unknown" },
      { key: "source", fallback: "unknown" },
    ];

    for (const field of fields) {
      entry[field.key] = String(frontmatter[field.key] || field.fallback);
    }

    const optionalKeys = ["portal", "target_branch", "model", "flow", "rejected_path", "subject"];
    for (const key of optionalKeys) {
      if (frontmatter[key]) entry[key] = String(frontmatter[key]);
    }

    if (frontmatter.skills) entry.skills = JSON.parse(String(frontmatter.skills));

    return entry;
  }
}
