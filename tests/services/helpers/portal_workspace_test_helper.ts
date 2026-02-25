/**
 * @module PortalWorkspaceTestHelper
 * @path tests/services/helpers/portal_workspace_test_helper.ts
 * @description Provides a reusable test harness for partitioned portal repositories,
 * ensuring stable discovery of portal-bound files and metadata.
 */

import { ensureDir } from "@std/fs";
import { join } from "@std/path";
import { PortalOperation } from "../../../src/enums.ts";
import type { IPortalPermissions } from "../../../src/schemas/portal_permissions.ts";

export async function setupPortalWorkspaceTestDirs(tempDir: string): Promise<{
  portalDir: string;
  workspaceDir: string;
  portalConfig: IPortalPermissions;
}> {
  const portalDir = join(tempDir, "portal");
  const workspaceDir = join(tempDir, "workspace");

  // Create directories with git repos
  await ensureDir(join(portalDir, ".git"));
  await ensureDir(join(workspaceDir, ".git"));
  await ensureDir(join(portalDir, "Blueprints", "Agents"));

  const portalConfig: IPortalPermissions = {
    alias: "test-portal",
    target_path: portalDir,
    operations: [PortalOperation.READ, PortalOperation.WRITE, PortalOperation.GIT],
    agents_allowed: ["*"],
  };

  return { portalDir, workspaceDir, portalConfig };
}
