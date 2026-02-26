/**
 * @module RequestCommands
 * @path src/cli/commands/request_commands.ts
 * @description Provides CLI commands for creating and managing agent requests, serving as the primary interface for human-to-agent communication.
 * @architectural-layer CLI
 * @dependencies [base_command, enums, request_status, request_create_handler, request_list_handler, request_show_handler]
 * @related-files [src/schemas/request.ts, src/cli/main.ts]
 */

import { BaseCommand, type ICommandContext } from "../base.ts";
import { RequestPriority } from "../../enums.ts";
import type { RequestStatusType } from "../../requests/request_status.ts";
import { RequestCreateHandler } from "../handlers/request_create_handler.ts";
import { RequestListHandler } from "../handlers/request_list_handler.ts";
import { RequestShowHandler } from "../handlers/request_show_handler.ts";

/**
 * Options for creating a request
 */
export interface IRequestOptions {
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
export interface IRequestMetadata {
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
export interface IRequestEntry {
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
export interface IRequestShowResult {
  metadata: IRequestEntry;
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
    context: ICommandContext,
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
    options: IRequestOptions = {},
    source: RequestSource = "cli",
  ): Promise<IRequestMetadata> {
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
    options: IRequestOptions = {},
  ): Promise<IRequestMetadata> {
    return await this.createHandler.createFromFile(filePath, options);
  }

  /**
   * List requests in the inbox
   * @param status Optional status filter
   * @returns Array of request entries sorted by created date (newest first)
   */
  async list(status?: RequestStatusType, includeArchived?: boolean): Promise<IRequestEntry[]> {
    return await this.listHandler.list(status, includeArchived);
  }

  /**
   * Show details of a specific request
   * @param idOrFilename Full trace_id, short trace_id (8 chars), or filename
   * @returns Request metadata and content body
   */
  async show(idOrFilename: string): Promise<IRequestShowResult> {
    return await this.showHandler.show(idOrFilename);
  }
}
