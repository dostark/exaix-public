import {
  PORTAL_CONTEXT_ALIAS_LABEL,
  PORTAL_CONTEXT_REPOSITORY_LABEL,
  PORTAL_CONTEXT_REQUIRED_ACTIONS,
  PORTAL_CONTEXT_REQUIRED_ACTIONS_TITLE,
  PORTAL_CONTEXT_ROOT_LABEL,
  PORTAL_CONTEXT_SECTION_TITLE,
} from "../config/constants.ts";

export interface PortalContextArgs {
  portalAlias: string;
  portalRoot: string;
  repositoryRoot?: string;
}

export function buildPortalContextBlock(args: PortalContextArgs): string {
  const repositoryRoot = args.repositoryRoot ?? args.portalRoot;
  const requiredActions = PORTAL_CONTEXT_REQUIRED_ACTIONS
    .map((action) => `- ${action}`)
    .join("\n");

  return [
    `## ${PORTAL_CONTEXT_SECTION_TITLE}`,
    `${PORTAL_CONTEXT_ALIAS_LABEL}: ${args.portalAlias}`,
    `${PORTAL_CONTEXT_ROOT_LABEL}: ${args.portalRoot}`,
    `${PORTAL_CONTEXT_REPOSITORY_LABEL}: ${repositoryRoot}`,
    "",
    `${PORTAL_CONTEXT_REQUIRED_ACTIONS_TITLE}:`,
    requiredActions,
  ].join("\n");
}
