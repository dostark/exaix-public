import { join } from "@std/path";
import type { CommandContext } from "../base.ts";

export function getWorkspaceRequestsDir(context: CommandContext): string {
  return join(
    context.config.system.root,
    context.config.paths.workspace,
    context.config.paths.requests,
  );
}
