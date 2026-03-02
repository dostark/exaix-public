/**
 * @module RequestAdapter
 * @path src/services/adapters/request_adapter.ts
 * @description Module for RequestAdapter.
 * @architectural-layer Services
 * @dependencies [IRequestService, RequestCommands]
 * @related-files [src/cli/commands/request_commands.ts, src/shared/interfaces/i_request_service.ts]
 */

import { IRequestService } from "../../shared/interfaces/i_request_service.ts";
import { type RequestStatusType } from "../../shared/status/request_status.ts";
import type {
  IRequestEntry,
  IRequestMetadata,
  IRequestOptions,
  IRequestShowResult,
  RequestSource,
} from "../../shared/types/request.ts";

export class RequestAdapter implements IRequestService {
  constructor(private service: any) {}

  async create(
    description: string,
    options?: IRequestOptions,
    source?: RequestSource,
  ): Promise<IRequestMetadata> {
    return await this.service.create(description, options, source);
  }

  async createRequest(description: string, options?: IRequestOptions): Promise<IRequestMetadata> {
    return await this.create(description, options);
  }

  async list(
    status?: RequestStatusType,
    includeArchived?: boolean,
  ): Promise<IRequestEntry[]> {
    return await this.service.list(status, includeArchived);
  }

  async listRequests(status?: RequestStatusType, includeArchived?: boolean): Promise<IRequestEntry[]> {
    return await this.list(status, includeArchived);
  }

  async show(idOrFilename: string): Promise<IRequestShowResult> {
    return await this.service.show(idOrFilename);
  }

  async getRequestContent(requestId: string): Promise<string> {
    return await this.service.getRequestContent(requestId);
  }

  async updateRequestStatus(requestId: string, status: RequestStatusType): Promise<boolean> {
    if (typeof this.service.updateRequestStatus !== "function") {
      return false;
    }
    return await this.service.updateRequestStatus(requestId, status);
  }
}
