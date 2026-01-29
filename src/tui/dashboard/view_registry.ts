/**
 * View Registry for TUI Dashboard
 * Extracted from tui_dashboard.ts to reduce complexity
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
import type { DatabaseService } from "../../services/db.ts";

export interface DashboardViewOptions {
  testMode?: boolean;
  databaseService?: DatabaseService;
}

/**
 * Initialize all views for the TUI dashboard
 */
export function initDashboardViews(options: DashboardViewOptions = {}): any[] {
  const portalService = new MockPortalService();
  const planService = new MockPlanService();
  const logService = options.databaseService || new MockLogService();
  const structuredLogger = new MockStructuredLogger();
  const structuredLoggerService = new MockStructuredLoggerService();
  const daemonService = new MockDaemonService();
  const agentService = new MockAgentService();
  const requestService = new MockRequestService();
  const memoryService = new MockMemoryService();
  const skillsService = new MockSkillsService();

  const views = [
    Object.assign(new PortalManagerView(portalService), { name: "PortalManagerView" }),
    Object.assign(new PlanReviewerView(planService), { name: "PlanReviewerView" }),
    Object.assign(new MonitorView(logService), { name: "MonitorView" }),
    Object.assign(
      new StructuredLogViewer(structuredLoggerService, structuredLogger as any, { testMode: options.testMode }),
      {
        name: "StructuredLogViewer",
      },
    ),
    Object.assign(new DaemonControlView(daemonService), { name: "DaemonControlView" }),
    Object.assign(new AgentStatusView(agentService), { name: "AgentStatusView" }),
    Object.assign(new RequestManagerView(requestService), { name: "RequestManagerView" }),
    Object.assign(new MemoryView(memoryService), { name: "MemoryView" }),
    Object.assign(new SkillsManagerView(skillsService), { name: "SkillsManagerView" }),
  ].map((view) => {
    const v: any = view;
    if (typeof v.getFocusableElements !== "function") {
      if (v.name === "PortalManagerView") {
        v.getFocusableElements = () => ["portal-list", "action-buttons", "status-bar"];
      } else {
        v.getFocusableElements = () => ["main"];
      }
    }
    return v;
  });

  return views;
}
