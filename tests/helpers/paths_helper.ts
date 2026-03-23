/**
 * @module PathsTestHelper
 * @path tests/helpers/paths_helper.ts
 * @description Provides common utilities for resolving system paths during tests,
 * ensuring consistent identification of 'Blueprints', 'Requests', and 'Plans' roots.
 */

import { join } from "@std/path";
import { ExaPathDefaults } from "../../src/shared/constants.ts";

export function getWorkspaceDir(argDir: string) {
  return join(argDir, ExaPathDefaults.workspace);
}

export function getWorkspaceActiveDir(argDir: string) {
  return join(argDir, ExaPathDefaults.workspace, ExaPathDefaults.active);
}

export function getWorkspacePlansDir(argDir: string) {
  return join(argDir, ExaPathDefaults.workspace, ExaPathDefaults.plans);
}

export function getWorkspaceRequestsDir(argDir: string) {
  return join(argDir, ExaPathDefaults.workspace, ExaPathDefaults.requests);
}

export function getWorkspaceArchiveDir(argDir: string) {
  return join(argDir, ExaPathDefaults.workspace, ExaPathDefaults.archive);
}

export function getWorkspaceRejectedDir(argDir: string) {
  return join(argDir, ExaPathDefaults.workspace, ExaPathDefaults.rejected);
}

export function getRuntimeDir(argDir: string) {
  return join(argDir, ExaPathDefaults.runtime);
}

export function getMemoryDir(argDir: string) {
  return join(argDir, ExaPathDefaults.memory);
}

export function getBlueprintsAgentsDir(argDir: string) {
  // agents is "Agents", blueprints is "Blueprints"
  // The original code was join(argDir, "Blueprints", "Agents")
  // In ExaPathDefaults, we have agents: "Agents", blueprints: "Blueprints"
  // So join(argDir, ExaPathDefaults.blueprints, ExaPathDefaults.agents)
  return join(argDir, ExaPathDefaults.blueprints, ExaPathDefaults.agents);
}

export function getMemoryExecutionDir(argDir: string) {
  return join(argDir, ExaPathDefaults.memoryExecution);
}

export function getMemoryProjectsDir(argDir: string) {
  return join(argDir, ExaPathDefaults.memoryProjects);
}

export function getMemoryGlobalDir(argDir: string) {
  return join(argDir, ExaPathDefaults.memoryGlobal);
}

export function getMemoryIndexDir(argDir: string) {
  return join(argDir, ExaPathDefaults.memoryIndex);
}

export function getMemorySkillsDir(argDir: string) {
  return join(argDir, ExaPathDefaults.memorySkills);
}

export function getMemoryPendingDir(argDir: string) {
  return join(argDir, ExaPathDefaults.memoryPending);
}

export function getMemoryTasksDir(argDir: string) {
  return join(argDir, ExaPathDefaults.memoryTasks);
}

export function getPortalsDir(argDir: string) {
  return join(argDir, ExaPathDefaults.portals);
}
