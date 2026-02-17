/**
 * @module RequestPaths
 * @path src/cli/handlers/request_paths.ts
 * @description Provides utility functions for resolving workspace request directories used by CLI handlers.
 * @architectural-layer CLI
 * @dependencies [path, base_command]
 * @related-files [src/cli/handlers/request_create_handler.ts]
 */

import { join } from "@std/path";
import type { CommandContext } from "../base.ts";

export function getWorkspaceRequestsDir(context: CommandContext): string {
  return join(
    context.config.system.root,
    context.config.paths.workspace,
    context.config.paths.requests,
  );
}
