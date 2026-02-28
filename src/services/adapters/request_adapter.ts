/**
 * @module RequestAdapter
 * @path src/services/adapters/request_adapter.ts
 * @description Module for RequestAdapter.
 * @architectural-layer Services
 * @dependencies [IRequestService, RequestCommands]
 * @related-files [src/cli/commands/request_commands.ts, src/shared/interfaces/i_request_service.ts]
 */

import { RequestCommands } from "../../cli/commands/request_commands.ts";
import { IRequestService } from "../../shared/interfaces/i_request_service.ts";
import { type RequestStatusType } from "../../shared/status/request_status.ts";
import type {
  IRequestEntry,
  IRequestMetadata,
  IRequestOptions,
  IRequestShowResult,
  RequestSource,
} from "../../shared/types/request.ts";

export class RequestServiceAdapter implements IRequestService {
  constructor(private commands: RequestCommands) {}

  async create(
    description: string,
    options?: IRequestOptions,
    source?: RequestSource,
  ): Promise<IRequestMetadata> {
    return await this.commands.create(description, options, source);
  }

  async createRequest(description: string, options?: IRequestOptions): Promise<IRequestMetadata> {
    return await this.create(description, options);
  }

  async list(
    status?: RequestStatusType,
    includeArchived?: boolean,
  ): Promise<IRequestEntry[]> {
    return await this.commands.list(status, includeArchived);
  }

  async listRequests(status?: RequestStatusType, includeArchived?: boolean): Promise<IRequestEntry[]> {
    return await this.list(status, includeArchived);
  }

  async show(idOrFilename: string): Promise<IRequestShowResult> {
    return await this.commands.show(idOrFilename);
  }

  async getRequestContent(requestId: string): Promise<string> {
    const details = await this.show(requestId);
    return details.content;
  }

  updateRequestStatus(_requestId: string, _status: RequestStatusType): Promise<boolean> {
    // RequestCommands doesn't have updateRequestStatus yet
    // This would require a handler that parses the request file and updates frontmatter
    return Promise.resolve(false);
  }
}
