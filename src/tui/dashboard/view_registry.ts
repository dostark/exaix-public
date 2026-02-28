/**
 * @module ViewRegistry
 * @path src/tui/dashboard/view_registry.ts
 * @description Central registry and initialization logic for all TUI views, facilitating service injection and focus management.
 * @architectural-layer TUI
 * @dependencies [PortalManagerView, PlanReviewerView, MonitorView, StructuredLogViewer, DaemonControlView, AgentStatusView, RequestManagerView, MemoryView, SkillsManagerView, TuiDashboardMocks]
 * @related-files [src/tui/dashboard_view.ts]
 */

import { PortalManagerView } from "../portal_manager_view.ts";
import { PlanReviewerView } from "../plan_reviewer_view.ts";
import { MonitorView } from "../monitor_view.ts";
import { StructuredLogViewer } from "../structured_log_viewer.ts";
import { DaemonControlView } from "../daemon_control_view.ts";
import { AgentStatusView } from "../agent_status_view.ts";
import { RequestManagerView } from "../request_manager_view.ts";
import { MemoryView } from "../memory_view.ts";
import { SkillsManagerView } from "../skills_manager_view.ts";
import { type ITuiView } from "../tui_dashboard.ts";
import type { ILogService } from "../../shared/interfaces/i_log_service.ts";
import { IJournalService } from "../../shared/interfaces/i_journal_service.ts";
import { IMemoryService } from "../../shared/interfaces/i_memory_service.ts";
import {
  MockAgentService,
  MockDaemonService,
  MockLogService,
  MockMemoryService,
  MockPlanService,
  MockPortalService,
  MockRequestService,
  MockSkillsService,
  MockStructuredLogger,
  MockStructuredLoggerService,
} from "../tui_dashboard_mocks.ts";

import { PortalCommands } from "../../cli/commands/portal_commands.ts";
import { PlanCommands } from "../../cli/commands/plan_commands.ts";
import { RequestCommands } from "../../cli/commands/request_commands.ts";
import { DaemonCommands } from "../../cli/commands/daemon_commands.ts";
import { join } from "@std/path";

import { PortalServiceAdapter } from "../../services/adapters/portal_adapter.ts";
import { PlanServiceAdapter } from "../../services/adapters/plan_adapter.ts";
import { RequestServiceAdapter } from "../../services/adapters/request_adapter.ts";
import { DaemonServiceAdapter } from "../../services/adapters/daemon_adapter.ts";
import { AgentServiceAdapter } from "../../services/adapters/agent_adapter.ts";
import { MemoryServiceAdapter } from "../../services/adapters/memory_adapter.ts";
import { JournalServiceAdapter } from "../../services/adapters/journal_adapter.ts";
import { LogServiceAdapter } from "../../services/adapters/log_adapter.ts";
import { ConfigServiceAdapter as _ConfigServiceAdapter } from "../../services/adapters/config_adapter.ts";

import { MemoryBankService } from "../../services/memory_bank.ts";
import { MemoryExtractorService } from "../../services/memory_extractor.ts";
import { SkillsService } from "../../services/skills.ts";
import { getGlobalLogger } from "../../services/structured_logger.ts";

import { IDatabaseService } from "../../shared/interfaces/i_database_service.ts";
import { IPortalService } from "../../shared/interfaces/i_portal_service.ts";
import { IPlanService } from "../../shared/interfaces/i_plan_service.ts";
import { IStructuredLogger } from "../../shared/interfaces/i_log_service.ts";
import { IDaemonService } from "../../shared/interfaces/i_daemon_service.ts";
import { IAgentService } from "../../shared/interfaces/i_agent_service.ts";
import { IRequestService } from "../../shared/interfaces/i_request_service.ts";
import { ISkillsService } from "../../shared/interfaces/i_skills_service.ts";
import { type Config } from "../../shared/schemas/config.ts";
import { type ICommandContext } from "../../cli/base.ts";

export interface IDashboardViewOptions {
  testMode?: boolean;
  databaseService?: IDatabaseService;
  config?: Config;
}

export interface IDashboardServices {
  portalService: IPortalService;
  planService: IPlanService;
  logService: IJournalService | IDatabaseService;
  structuredLogger: IStructuredLogger;
  structuredLoggerService: ILogService;
  daemonService: IDaemonService;
  agentService: IAgentService;
  requestService: IRequestService;
  memoryService: IMemoryService;
  skillsService: ISkillsService;
}

export interface IDashboardViewsAndServices {
  views: ITuiView[];
  services: IDashboardServices;
}

/**
 * Initialize all views for the TUI dashboard
 */
export function initDashboardViews(
  options: IDashboardViewOptions = {},
): IDashboardViewsAndServices {
  let portalService: IPortalService;
  let planService: IPlanService;
  let logService: IJournalService | IDatabaseService;
  let structuredLogger: IStructuredLogger;
  let structuredLoggerService: ILogService;
  let daemonService: IDaemonService;
  let agentService: IAgentService;
  let requestService: IRequestService;
  let memoryService: IMemoryService;
  let skillsService: ISkillsService;

  if (options.testMode || !options.config || !options.databaseService) {
    portalService = new MockPortalService();
    planService = new MockPlanService();
    logService = options.databaseService || new MockLogService();
    structuredLogger = new MockStructuredLogger();
    structuredLoggerService = new MockStructuredLoggerService();
    daemonService = new MockDaemonService();
    agentService = new MockAgentService();
    requestService = new MockRequestService();
    memoryService = new MockMemoryService();
    skillsService = new MockSkillsService();
  } else {
    const context: ICommandContext = {
      config: options.config,
      db: options.databaseService,
    };

    portalService = new PortalServiceAdapter(new PortalCommands(context));
    planService = new PlanServiceAdapter(new PlanCommands(context));
    // logService for MonitorView (IJournalService)
    logService = new JournalServiceAdapter(options.databaseService);
    // structuredLogger and service for StructuredLogViewer
    const logger = getGlobalLogger();
    structuredLogger = logger;
    structuredLoggerService = new LogServiceAdapter(logger);

    daemonService = new DaemonServiceAdapter(new DaemonCommands(context));
    agentService = new AgentServiceAdapter(context);
    requestService = new RequestServiceAdapter(new RequestCommands(context));

    // MemoryService for MemoryView
    const memoryBank = new MemoryBankService(options.config, options.databaseService);
    const extractor = new MemoryExtractorService(options.config, options.databaseService, memoryBank);
    memoryService = new MemoryServiceAdapter(memoryBank, extractor);

    const memoryDir = join(options.config.system.root!, options.config.paths.memory!);
    skillsService = new SkillsService({ memoryDir }, options.databaseService);
  }

  const services: IDashboardServices = {
    portalService,
    planService,
    logService,
    structuredLogger,
    structuredLoggerService,
    daemonService,
    agentService,
    requestService,
    memoryService,
    skillsService,
  };

  const views = [
    Object.assign(new PortalManagerView(portalService), { name: "PortalManagerView" }),
    Object.assign(new PlanReviewerView(planService), { name: "PlanReviewerView" }),
    Object.assign(new MonitorView(logService as IJournalService), { name: "MonitorView" }),
    Object.assign(
      new StructuredLogViewer(structuredLoggerService, structuredLogger, {
        testMode: options.testMode,
      }),
      {
        name: "StructuredLogViewer",
      },
    ),
    Object.assign(new DaemonControlView(daemonService), { name: "DaemonControlView" }),
    Object.assign(new AgentStatusView(agentService), { name: "AgentStatusView" }),
    Object.assign(new RequestManagerView(requestService), { name: "RequestManagerView" }),
    Object.assign(
      new MemoryView(
        memoryService as IMemoryService,
      ),
      { name: "MemoryView" },
    ),
    Object.assign(new SkillsManagerView(skillsService), { name: "SkillsManagerView" }),
  ].map((view) => {
    const v = view as ITuiView;
    if (typeof v.getFocusableElements !== "function") {
      if (v.name === "PortalManagerView") {
        v.getFocusableElements = () => ["portal-list", "action-buttons", "status-bar"];
      } else {
        v.getFocusableElements = () => ["main"];
      }
    }
    return v;
  });

  return { views, services };
}
