/**
 * @module RequestCommands
 * @path src/cli/request_commands.ts
 * @description Provides CLI commands for creating and managing agent requests, serving as the primary interface for human-to-agent communication.
 * @architectural-layer CLI
 * @dependencies [base_command, enums, request_status, request_create_handler, request_list_handler, request_show_handler]
 * @related-files [src/schemas/request.ts, src/cli/main.ts]
 */

import { BaseCommand, type CommandContext } from "./base.ts";
import { RequestPriority } from "../enums.ts";
import type { RequestStatusType } from "../requests/request_status.ts";
import { RequestCreateHandler } from "./handlers/request_create_handler.ts";
import { RequestListHandler } from "./handlers/request_list_handler.ts";
import { RequestShowHandler } from "./handlers/request_show_handler.ts";

/**
 * Options for creating a request
 */
export interface RequestOptions {
  agent?: string;
  priority?: RequestPriority;
  portal?: string;
  target_branch?: string;
  model?: string;
  flow?: string;
  skills?: string[];
}

/**
 * Source of request creation
 */
export type RequestSource = "cli" | "file" | "interactive";

/**
 * Metadata returned when a request is created
 */
export interface RequestMetadata {
  trace_id: string;
  filename: string;
  path: string;
  status: RequestStatusType;
  priority: RequestPriority;
  agent: string;
  portal?: string;
  target_branch?: string;
  model?: string;
  flow?: string;
  skills?: string[];
  input_tokens?: string;
  output_tokens?: string;
  total_tokens?: string;
  token_provider?: string;
  token_model?: string;
  token_cost_usd?: string;
  created: string;
  created_by: string;
  source: RequestSource;
  rejected_path?: string;
}

/**
 * Request entry when listing
 */
export interface RequestEntry {
  trace_id: string;
  filename: string;
  path: string;
  status: RequestStatusType;
  priority: string;
  agent: string;
  portal?: string;
  target_branch?: string;
  model?: string;
  flow?: string;
  skills?: string[];
  input_tokens?: string;
  output_tokens?: string;
  total_tokens?: string;
  token_provider?: string;
  token_model?: string;
  token_cost_usd?: string;
  created: string;
  created_by: string;
  source: string;
  error?: string;
  rejected_path?: string;
}

/**
 * Result of showing a request
 */
export interface RequestShowResult {
  metadata: RequestEntry;
  content: string;
}

/**
 * RequestCommands provides CLI operations for creating and managing requests.
 * All operations are logged to activity_log with actor='human'.
 */
export class RequestCommands extends BaseCommand {
  private createHandler: RequestCreateHandler;
  private listHandler: RequestListHandler;
  private showHandler: RequestShowHandler;

  constructor(
    context: CommandContext,
  ) {
    super(context);
    this.createHandler = new RequestCreateHandler(context);
    this.listHandler = new RequestListHandler(context);
    this.showHandler = new RequestShowHandler(context);
  }

  /**
   * Create a new request with the given description
   * @param description The request description/task
   * @param options Optional settings (agent, priority, portal)
   * @param source How the request was created (cli, file, interactive)
   * @returns Request metadata including path and trace_id
   */
  async create(
    description: string,
    options: RequestOptions = {},
    source: RequestSource = "cli",
  ): Promise<RequestMetadata> {
    return await this.createHandler.create(description, options, source);
  }

  /**
   * Create a request from a file's content
   * @param filePath Path to file containing the request description
   * @param options Optional settings (agent, priority, portal)
   * @returns Request metadata
   */
  async createFromFile(
    filePath: string,
    options: RequestOptions = {},
  ): Promise<RequestMetadata> {
    return await this.createHandler.createFromFile(filePath, options);
  }

  /**
   * List requests in the inbox
   * @param status Optional status filter
   * @returns Array of request entries sorted by created date (newest first)
   */
  async list(status?: RequestStatusType): Promise<RequestEntry[]> {
    return await this.listHandler.list(status);
  }

  /**
   * Show details of a specific request
   * @param idOrFilename Full trace_id, short trace_id (8 chars), or filename
   * @returns Request metadata and content body
   */
  async show(idOrFilename: string): Promise<RequestShowResult> {
    return await this.showHandler.show(idOrFilename);
  }
}
