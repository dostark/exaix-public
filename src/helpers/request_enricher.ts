/**
 * @module RequestEnricher
 * @path src/helpers/request_enricher.ts
 * @description Utility to enrich metadata with full request information from the database or workspace.
 * @architectural-layer Helpers
 * @dependencies [RequestCommands, EnvConfig]
 * @related-files [src/cli/request_commands.ts]
 */
import { RequestCommands } from "../cli/commands/request_commands.ts";
import { isTestMode } from "../config/env_schema.ts";

export interface RequestEnrichable {
  request_id?: string;
  request_title?: string;
  request_agent?: string;
  request_portal?: string;
  request_priority?: string;
  request_created_by?: string;
  request_flow?: string;
  request_rejected_path?: string;
}
export async function enrichWithRequest<T extends RequestEnrichable>(
  requestCommands: RequestCommands,
  metadata: T,
  idPlaceholder = "unknown",
): Promise<T> {
  if (!metadata.request_id) {
    return metadata;
  }

  try {
    // Extract trace_id from request_id (format: "request-{trace_id}")
    let requestIdentifier = metadata.request_id;
    if (metadata.request_id.startsWith("request-")) {
      requestIdentifier = metadata.request_id.substring(8); // Remove "request-" prefix
    }

    const requestResult = await requestCommands.show(requestIdentifier);
    const request = requestResult.metadata;

    // Extract title from content (first header or first non-empty line)
    const contentLines = requestResult.content.split("\n").map((line) => line.trim()).filter((line) => line);
    let title = "Untitled Request";

    for (const line of contentLines) {
      if (line.startsWith("# ")) {
        title = line.substring(2).trim();
        break;
      } else if (!line.startsWith("#") && line) {
        title = line;
        break;
      }
    }

    return {
      ...metadata,
      request_title: title,
      request_agent: request.agent,
      request_portal: request.portal,
      request_priority: request.priority,
      request_created_by: request.created_by,
      request_flow: (request as any).flow,
      request_rejected_path: (request as any).rejected_path,
    };
  } catch (error) {
    // If request can't be loaded, continue without request info
    if (!isTestMode()) {
      console.warn(`Warning: Could not load request info for ${idPlaceholder}:`, error);
    }
    return metadata;
  }
}
