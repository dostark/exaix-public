/**
 * @module IExoPaths
 * @path src/config/paths.ts
 * @description Defines the standard directory structure and path resolution logic for the ExoFrame workspace and memory banks.
 * @architectural-layer Config
 * @dependencies [constants]
 * @related-files [src/config/schema.ts, src/config/constants.ts]
 */

import * as DEFAULTS from "../shared/constants.ts";

export interface IExoPaths {
  workspace: string;
  runtime: string;
  memory: string;
  portals: string;
  blueprints: string;
  active: string;
  archive: string;
  plans: string;
  requests: string;
  rejected: string;
  agents: string;
  flows: string;
  memoryProjects: string;
  memoryExecution: string;
  memoryIndex: string;
  memorySkills: string;
  memoryPending: string;
  memoryTasks: string;
  memoryGlobal: string;
}

export function getDefaultPaths(_root: string): IExoPaths {
  return {
    workspace: DEFAULTS.DEFAULT_WORKSPACE_PATH,
    runtime: DEFAULTS.DEFAULT_RUNTIME_PATH,
    memory: DEFAULTS.DEFAULT_MEMORY_PATH,
    portals: DEFAULTS.DEFAULT_PORTALS_PATH,
    blueprints: DEFAULTS.DEFAULT_BLUEPRINTS_PATH,
    active: DEFAULTS.DEFAULT_ACTIVE_PATH,
    archive: DEFAULTS.DEFAULT_ARCHIVE_PATH,
    plans: DEFAULTS.DEFAULT_PLANS_PATH,
    requests: DEFAULTS.DEFAULT_REQUESTS_PATH,
    rejected: DEFAULTS.DEFAULT_REJECTED_PATH,
    agents: DEFAULTS.DEFAULT_AGENTS_PATH,
    flows: DEFAULTS.DEFAULT_FLOWS_PATH,
    memoryProjects: DEFAULTS.DEFAULT_PROJECTS_MEMORY_PATH,
    memoryExecution: DEFAULTS.DEFAULT_EXECUTION_MEMORY_PATH,
    memoryIndex: DEFAULTS.DEFAULT_INDEX_MEMORY_PATH,
    memorySkills: DEFAULTS.DEFAULT_SKILLS_MEMORY_PATH,
    memoryPending: DEFAULTS.DEFAULT_PENDING_MEMORY_PATH,
    memoryTasks: DEFAULTS.DEFAULT_TASKS_MEMORY_PATH,
    memoryGlobal: DEFAULTS.DEFAULT_GLOBAL_MEMORY_PATH,
  };
}
