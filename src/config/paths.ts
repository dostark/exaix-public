import { join } from "@std/path";
import * as DEFAULTS from "./constants.ts";

export interface ExoPaths {
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

export function getDefaultPaths(root: string): ExoPaths {
  const workspace = join(root, DEFAULTS.DEFAULT_WORKSPACE_PATH);
  const memory = join(root, DEFAULTS.DEFAULT_MEMORY_PATH);
  const blueprints = join(root, DEFAULTS.DEFAULT_BLUEPRINTS_PATH);

  return {
    workspace,
    runtime: join(root, DEFAULTS.DEFAULT_RUNTIME_PATH),
    memory,
    portals: join(root, DEFAULTS.DEFAULT_PORTALS_PATH),
    blueprints,
    active: join(workspace, DEFAULTS.DEFAULT_ACTIVE_PATH),
    archive: join(workspace, DEFAULTS.DEFAULT_ARCHIVE_PATH),
    plans: join(workspace, DEFAULTS.DEFAULT_PLANS_PATH),
    requests: join(workspace, DEFAULTS.DEFAULT_REQUESTS_PATH),
    rejected: join(workspace, DEFAULTS.DEFAULT_REJECTED_PATH),
    agents: join(blueprints, DEFAULTS.DEFAULT_AGENTS_PATH),
    flows: join(blueprints, DEFAULTS.DEFAULT_FLOWS_PATH),
    memoryProjects: join(memory, DEFAULTS.DEFAULT_PROJECTS_MEMORY_PATH),
    memoryExecution: join(memory, DEFAULTS.DEFAULT_EXECUTION_MEMORY_PATH),
    memoryIndex: join(memory, DEFAULTS.DEFAULT_INDEX_MEMORY_PATH),
    memorySkills: join(memory, DEFAULTS.DEFAULT_SKILLS_MEMORY_PATH),
    memoryPending: join(memory, DEFAULTS.DEFAULT_PENDING_MEMORY_PATH),
    memoryTasks: join(memory, DEFAULTS.DEFAULT_TASKS_MEMORY_PATH),
    memoryGlobal: join(memory, DEFAULTS.DEFAULT_GLOBAL_MEMORY_PATH),
  };
}
