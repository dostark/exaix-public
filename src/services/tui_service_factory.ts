/**
 * @module TuiServiceFactory
 * @path src/services/tui_service_factory.ts
 * @description Factory for creating service instances used by the TUI dashboard.
 * This module bridges the core services with the TUI interface layer.
 * @architectural-layer Services
 * @dependencies [Service Adapters, CLI Commands, Core Services]
 * @related-files [src/tui/dashboard/view_registry.ts, src/cli/commands/dashboard_commands.ts]
 */

import { PortalCommands } from "../cli/commands/portal_commands.ts";
import { PlanCommands } from "../cli/commands/plan_commands.ts";
import { RequestCommands } from "../cli/commands/request_commands.ts";
import { DaemonCommands } from "../cli/commands/daemon_commands.ts";

import { PortalServiceAdapter } from "./adapters/portal_adapter.ts";
import { PlanServiceAdapter } from "./adapters/plan_adapter.ts";
import { RequestServiceAdapter } from "./adapters/request_adapter.ts";
import { DaemonServiceAdapter } from "./adapters/daemon_adapter.ts";
import { AgentServiceAdapter } from "./adapters/agent_adapter.ts";
import { MemoryServiceAdapter } from "./adapters/memory_adapter.ts";
import { JournalServiceAdapter } from "./adapters/journal_adapter.ts";
import { LogServiceAdapter } from "./adapters/log_adapter.ts";

import { MemoryBankService } from "./memory_bank.ts";
import { MemoryExtractorService } from "./memory_extractor.ts";
import { SkillsService } from "./skills.ts";
import { getGlobalLogger } from "./structured_logger.ts";

import { join } from "@std/path";
import type { IDatabaseService } from "../shared/interfaces/i_database_service.ts";
import type { IPortalService } from "../shared/interfaces/i_portal_service.ts";
import type { IPlanService } from "../shared/interfaces/i_plan_service.ts";
import type { IStructuredLogger } from "../shared/interfaces/i_log_service.ts";
import type { IDaemonService } from "../shared/interfaces/i_daemon_service.ts";
import type { IAgentService } from "../shared/interfaces/i_agent_service.ts";
import type { IRequestService } from "../shared/interfaces/i_request_service.ts";
import type { IMemoryService } from "../shared/interfaces/i_memory_service.ts";
import type { ISkillsService } from "../shared/interfaces/i_skills_service.ts";
import type { ILogService } from "../shared/interfaces/i_log_service.ts";
import type { IJournalService } from "../shared/interfaces/i_journal_service.ts";
import type { Config } from "../shared/schemas/config.ts";

/**
 * Service bundle for TUI initialization
 */
export interface ITuiServiceBundle {
  portalService: IPortalService;
  planService: IPlanService;
  journalService: IJournalService;
  structuredLogger: IStructuredLogger;
  structuredLoggerService: ILogService;
  daemonService: IDaemonService;
  agentService: IAgentService;
  requestService: IRequestService;
  memoryService: IMemoryService;
  skillsService: ISkillsService;
}

/**
 * Options for creating TUI services
 */
export interface ITuiServiceFactoryOptions {
  config: Config;
  databaseService: IDatabaseService;
}

/**
 * Create all services needed by the TUI dashboard.
 * This function bridges core services with TUI interfaces.
 */
export function createTuiServices(
  options: ITuiServiceFactoryOptions,
): ITuiServiceBundle {
  const { config, databaseService } = options;

  // Create command context for CLI commands
  const context = {
    config,
    db: databaseService,
  };

  // Create service adapters that implement TUI interfaces
  const portalService: IPortalService = new PortalServiceAdapter(
    new PortalCommands(context),
  );
  const planService: IPlanService = new PlanServiceAdapter(
    new PlanCommands(context),
  );
  const journalService: IJournalService = new JournalServiceAdapter(databaseService);
  const requestService: IRequestService = new RequestServiceAdapter(
    new RequestCommands(context),
  );
  const daemonService: IDaemonService = new DaemonServiceAdapter(
    new DaemonCommands(context),
  );
  const agentService: IAgentService = new AgentServiceAdapter(context);

  // Initialize structured logger
  const logger = getGlobalLogger();
  const structuredLogger: IStructuredLogger = logger;
  const structuredLoggerService: ILogService = new LogServiceAdapter(logger);

  // Initialize memory services
  const memoryBank = new MemoryBankService(config, databaseService);
  const extractor = new MemoryExtractorService(config, databaseService, memoryBank);
  const memoryService: IMemoryService = new MemoryServiceAdapter(memoryBank, extractor);

  // Initialize skills service
  const memoryDir = join(config.system.root!, config.paths.memory!);
  const skillsService: ISkillsService = new SkillsService({ memoryDir }, databaseService);

  return {
    portalService,
    planService,
    journalService,
    structuredLogger,
    structuredLoggerService,
    daemonService,
    agentService,
    requestService,
    memoryService,
    skillsService,
  };
}
