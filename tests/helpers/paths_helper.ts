/**
 * @module PathsTestHelper
 * @path tests/helpers/paths_helper.ts
 * @description Provides common utilities for resolving system paths during tests,
 * ensuring consistent identification of 'Blueprints', 'Requests', and 'Plans' roots.
 */

import { join } from "@std/path";
import { ExoPathDefaults } from "../../src/config/constants.ts";

export function getWorkspaceDir(argDir: string) {
  return join(argDir, ExoPathDefaults.workspace);
}

export function getWorkspaceActiveDir(argDir: string) {
  return join(argDir, ExoPathDefaults.workspace, ExoPathDefaults.active);
}

export function getWorkspacePlansDir(argDir: string) {
  return join(argDir, ExoPathDefaults.workspace, ExoPathDefaults.plans);
}

export function getWorkspaceRequestsDir(argDir: string) {
  return join(argDir, ExoPathDefaults.workspace, ExoPathDefaults.requests);
}

export function getWorkspaceArchiveDir(argDir: string) {
  return join(argDir, ExoPathDefaults.workspace, ExoPathDefaults.archive);
}

export function getWorkspaceRejectedDir(argDir: string) {
  return join(argDir, ExoPathDefaults.workspace, ExoPathDefaults.rejected);
}

export function getRuntimeDir(argDir: string) {
  return join(argDir, ExoPathDefaults.runtime);
}

export function getMemoryDir(argDir: string) {
  return join(argDir, ExoPathDefaults.memory);
}

export function getBlueprintsAgentsDir(argDir: string) {
  // agents is "Agents", blueprints is "Blueprints"
  // The original code was join(argDir, "Blueprints", "Agents")
  // In ExoPathDefaults, we have agents: "Agents", blueprints: "Blueprints"
  // So join(argDir, ExoPathDefaults.blueprints, ExoPathDefaults.agents)
  return join(argDir, ExoPathDefaults.blueprints, ExoPathDefaults.agents);
}

export function getMemoryExecutionDir(argDir: string) {
  return join(argDir, ExoPathDefaults.memoryExecution);
}

export function getMemoryProjectsDir(argDir: string) {
  return join(argDir, ExoPathDefaults.memoryProjects);
}

export function getMemoryGlobalDir(argDir: string) {
  return join(argDir, ExoPathDefaults.memoryGlobal);
}

export function getMemoryIndexDir(argDir: string) {
  return join(argDir, ExoPathDefaults.memoryIndex);
}

export function getMemorySkillsDir(argDir: string) {
  return join(argDir, ExoPathDefaults.memorySkills);
}

export function getMemoryPendingDir(argDir: string) {
  return join(argDir, ExoPathDefaults.memoryPending);
}

export function getMemoryTasksDir(argDir: string) {
  return join(argDir, ExoPathDefaults.memoryTasks);
}

export function getPortalsDir(argDir: string) {
  return join(argDir, ExoPathDefaults.portals);
}
