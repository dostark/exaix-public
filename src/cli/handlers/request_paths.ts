/**
 * @module RequestPaths
 * @path src/cli/handlers/request_paths.ts
 * @description Provides utility functions for resolving workspace request directories used by CLI handlers.
 * @architectural-layer CLI
 * @dependencies [path, base_command]
 * @related-files [src/cli/handlers/request_create_handler.ts]
 */

import { join } from "@std/path";
import type { ICommandContext } from "../base.ts";

export function getWorkspaceRequestsDir(context: ICommandContext): string {
  const config = context.config.getAll();
  return join(
    config.system.root,
    config.paths.workspace,
    config.paths.requests,
  );
}

export function getWorkspaceArchiveDir(context: ICommandContext): string {
  const config = context.config.getAll();
  return join(
    config.system.root,
    config.paths.workspace,
    config.paths.archive,
  );
}

export function getWorkspaceRejectedDir(context: ICommandContext): string {
  const config = context.config.getAll();
  return join(
    config.system.root,
    config.paths.workspace,
    config.paths.rejected,
  );
}
