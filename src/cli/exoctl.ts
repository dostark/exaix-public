#!/usr/bin/env -S deno run --allow-all --no-check
/**
 * ExoFrame CLI (exoctl) - Human Interface for System Management
 *
 * Provides commands for:
 * - Plan review (approve/reject/revise)
 * - Changeset review (approve/reject code changes)
 * - Git operations (branch/status/log with trace_id)
 * - Daemon control (start/stop/status)
 * - Portal management (add/remove/verify external projects)
 *
 * NOTE: Run with --no-check flag for rapid development.
 */

import { Command } from "@cliffy/command";
import { PlanCommands } from "./plan_commands.ts";
import { RequestCommands } from "./request_commands.ts";
import { ChangesetCommands } from "./changeset_commands.ts";
import { GitCommands } from "./git_commands.ts";
import { DaemonCommands } from "./daemon_commands.ts";
import { PortalCommands } from "./portal_commands.ts";
import { BlueprintCommands } from "./blueprint_commands.ts";
import { FlowCommands } from "./flow_commands.ts";
import { DashboardCommands } from "./dashboard_commands.ts";
import { MemoryCommands } from "./memory_commands.ts";
import { JournalCommands } from "./commands/journal.ts";
import { RequestPriority } from "../enums.ts";
import { CLI_DEFAULTS, PRIORITY_ICONS } from "./cli.config.ts";
import { McpCommands } from "./commands/mcp.ts";
import { initializeServices, isTestMode as isTestModeImport } from "./init.ts";

// Allow tests to run the CLI entrypoint without initializing heavy services
export function isTestMode() {
  return isTestModeImport();
}

let config: any;
let db: any;
let gitService: any;
let provider: any;
let display: any;
let context: any;
let configService: any;

const services = await initializeServices();
if (services.success) {
  ({ config, db, gitService, provider, display, configService } = services);
  context = { config, db, provider };
} else {
  // Fallback context from safe initialization
  ({ config, db, gitService, provider, display } = services);
  context = { config, db, provider };
}

const requestCommands = new RequestCommands(context);
const planCommands = new PlanCommands(context);
const changesetCommands = new ChangesetCommands(context, gitService);
const gitCommands = new GitCommands(context);
const daemonCommands = new DaemonCommands({ ...context, configService });
const portalCommands = new PortalCommands({ config, db, configService });
const blueprintCommands = new BlueprintCommands(context);
const flowCommands = new FlowCommands(context);
const dashboardCommands = new DashboardCommands(context);
const memoryCommands = new MemoryCommands({ config, db });

// Export test helper for unit tests to inspect module-internal context when running in test mode.
export function __test_getContext() {
  return {
    IN_TEST_MODE: isTestMode(),
    config,
    db,
    gitService,
    provider,
    display,
    context,
    requestCommands,
    planCommands,
    changesetCommands,
    gitCommands,
    daemonCommands,
    portalCommands,
    blueprintCommands,
    flowCommands,
    dashboardCommands,
    memoryCommands,
  } as const;
}

// Test helper: initialize the heavy services path (same logic used in non-test runtime)
// Returns an object describing whether initialization succeeded and the constructed services.
// Test helper: initialize the heavy services path (same logic used in non-test runtime)
// Returns an object describing whether initialization succeeded and the constructed services.
export function __test_initializeServices(
  opts?: { simulateFail?: boolean; instantiateDb?: boolean; configPath?: string },
) {
  return initializeServices(opts);
}

export const __test_command = new Command()
  .name("exoctl")
  .version("1.0.0")
  .description("ExoFrame CLI - Human interface for agent orchestration")
  // Request commands (PRIMARY INTERFACE)
  .command(
    "request",
    new Command()
      .description("Create requests for ExoFrame agents or multi-agent flows (PRIMARY INTERFACE)")
      .arguments("[description:string]")
      .option("-a, --agent <agent:string>", "Target agent blueprint", { default: CLI_DEFAULTS.AGENT })
      .option("-p, --priority <priority:string>", "Priority: low, normal, high, critical", {
        default: CLI_DEFAULTS.PRIORITY,
      })
      .option("--portal <portal:string>", "Portal alias for context")
      .option("-m, --model <model:string>", "Named model configuration")
      .option("--flow <flow:string>", "Target multi-agent flow (mutually exclusive with --agent)")
      .option("--skills <skills:string>", "Comma-separated list of skills to inject")
      .option("-f, --file <file:string>", "Read description from file")
      .option("--dry-run", "Show what would be created without writing")
      .option("--json", "Output in JSON format")
      .action(async (options, description?: string) => {
        try {
          // Handle file input
          if (options.file) {
            const result = await requestCommands.createFromFile(options.file, {
              agent: options.flow ? undefined : options.agent,
              priority: options.priority as RequestPriority,
              portal: options.portal,
              model: options.model,
              flow: options.flow,
              skills: options.skills ? options.skills.split(",").map((s) => s.trim()) : undefined,
            });
            printRequestResult(result, !!options.json, !!options.dryRun);
            return;
          }

          // Require description for inline mode
          if (!description) {
            display.error("cli.error", "request", {
              message: 'Description required. Usage: exoctl request "<description>" or use --file',
            });
            Deno.exit(1);
          }

          // Create request
          const result = await requestCommands.create(description, {
            agent: options.flow ? undefined : options.agent,
            priority: options.priority as RequestPriority,
            portal: options.portal,
            model: options.model,
            flow: options.flow,
            skills: options.skills ? options.skills.split(",").map((s) => s.trim()) : undefined,
          });

          if (options.dryRun) {
            display.info("cli.dry_run", "request", { would_create: result.filename });
            return;
          }

          printRequestResult(result, !!options.json, false);
        } catch (error) {
          display.error("cli.error", "request", { message: error instanceof Error ? error.message : "Unknown error" });
          Deno.exit(1);
        }
      })
      .example("Create a request for a specific agent", 'exoctl request "Analyze this code" --agent code-reviewer')
      .example("Create a request for a multi-agent flow", 'exoctl request "Build a web app" --flow web-development')
      .example(
        "Create a high-priority request",
        'exoctl request "Fix critical bug" --priority critical --agent debugger',
      )
      .command(
        "list",
        new Command()
          .description("List pending requests")
          .option("-s, --status <status:string>", "Filter by status")
          .option("--json", "Output in JSON format")
          .action(async (options) => {
            try {
              const requests = await requestCommands.list(options.status);
              if (options.json) {
                display.info("cli.output", "requests", { data: JSON.stringify(requests, null, 2) });
              } else {
                if (requests.length === 0) {
                  display.info("request.list", "requests", { count: 0, message: "No requests found" });
                  return;
                }
                display.info("request.list", "requests", { count: requests.length });
                for (const req of requests) {
                  const priorityIcon = PRIORITY_ICONS[req.priority] || PRIORITY_ICONS.default;
                  display.info(`${priorityIcon} ${req.trace_id.slice(0, 8)}`, req.trace_id, {
                    status: req.status,
                    agent: req.flow ? undefined : req.agent,
                    flow: req.flow,
                    created: `${req.created_by} @ ${req.created}`,
                  });
                }
              }
            } catch (error) {
              display.error("cli.error", "request list", {
                message: error instanceof Error ? error.message : "Unknown error",
              });
              Deno.exit(1);
            }
          }),
      )
      .command(
        "show <id>",
        new Command()
          .description("Show request details")
          .action(async (_options: void, ...args: string[]) => {
            const id = args[0];
            try {
              const { metadata, content } = await requestCommands.show(id);
              display.info("request.show", metadata.trace_id.slice(0, 8), {
                trace_id: metadata.trace_id,
                status: metadata.status,
                priority: metadata.priority,
                agent: metadata.flow ? undefined : metadata.agent,
                flow: metadata.flow,
                created: `${metadata.created_by} @ ${metadata.created}`,
              });
              display.info("request.content", id, { content });
            } catch (error) {
              display.error("cli.error", "request show", {
                message: error instanceof Error ? error.message : "Unknown error",
              });
              Deno.exit(1);
            }
          }),
      ),
  )
  // Plan commands
  .command(
    "plan",
    new Command()
      .description("Manage AI-generated plans")
      .command(
        "list",
        new Command()
          .description("List all plans awaiting review")
          .option("-s, --status <status:string>", "Filter by status (review, needs_revision)")
          .action(async (options) => {
            try {
              const plans = await planCommands.list(options.status);
              if (plans.length === 0) {
                display.info("plan.list", "plans", { count: 0, message: "No plans found" });
                return;
              }
              display.info("plan.list", "plans", { count: plans.length });
              for (const plan of plans) {
                const statusIcon = plan.status === "review" ? "🔍" : "⚠️";
                const displayData: Record<string, unknown> = {
                  status: plan.status,
                  trace: plan.trace_id ? `${plan.trace_id.substring(0, 8)}...` : undefined,
                };

                // Add request information if available
                if (plan.request_title) {
                  displayData.request = plan.request_title.length > 50
                    ? `${plan.request_title.substring(0, 47)}...`
                    : plan.request_title;
                }
                if (plan.request_agent) {
                  displayData.agent = plan.request_agent;
                }
                if (plan.request_portal) {
                  displayData.portal = plan.request_portal;
                }
                if (plan.request_priority) {
                  displayData.priority = plan.request_priority;
                }

                display.info(`${statusIcon} ${plan.id}`, plan.id, displayData);
              }
            } catch (error) {
              display.error("cli.error", "plan list", {
                message: error instanceof Error ? error.message : "Unknown error",
              });
              Deno.exit(1);
            }
          }),
      )
      .command(
        "show <id>",
        new Command()
          .description("Show details of a specific plan")
          .action(async (_options, ...args: string[]) => {
            const id = args[0] as unknown as string;
            try {
              const plan = await planCommands.show(id);
              const displayData: Record<string, unknown> = {
                status: plan.status,
                trace: plan.trace_id,
              };

              // Add request information if available
              if (plan.request_id) {
                displayData.request = plan.request_id;
              }
              if (plan.request_title) {
                displayData.title = plan.request_title;
              }
              if (plan.request_agent) {
                displayData.agent = plan.request_agent;
              }
              if (plan.request_portal) {
                displayData.portal = plan.request_portal;
              }
              if (plan.request_priority) {
                displayData.priority = plan.request_priority;
              }
              if (plan.request_created_by) {
                displayData.created_by = plan.request_created_by;
              }

              display.info("plan.show", plan.id, displayData);
              display.info("plan.content", id, { content: plan.content });
            } catch (error) {
              display.error("cli.error", "plan show", {
                message: error instanceof Error ? error.message : "Unknown error",
              });
              Deno.exit(1);
            }
          }),
      )
      .command(
        "approve <id>",
        new Command()
          .description("Approve a plan and move it to Workspace/Active")
          .option("--skills <skills:string>", "Comma-separated list of skills to inject during execution")
          .action(async (options, ...args: string[]) => {
            const id = args[0] as unknown as string;
            try {
              await planCommands.approve(
                id,
                options.skills ? options.skills.split(",").map((s) => s.trim()) : undefined,
              );
            } catch (error) {
              display.error("cli.error", "plan approve", {
                message: error instanceof Error ? error.message : "Unknown error",
              });
              Deno.exit(1);
            }
          }),
      )
      .command(
        "reject <id>",
        new Command()
          .description("Reject a plan with a reason")
          .option("-r, --reason <reason:string>", "Rejection reason (required)", { required: true })
          .action(async (options, ...args: string[]) => {
            const id = args[0] as unknown as string;
            try {
              await planCommands.reject(id, options.reason);
            } catch (error) {
              display.error("cli.error", "plan reject", {
                message: error instanceof Error ? error.message : "Unknown error",
              });
              Deno.exit(1);
            }
          }),
      )
      .command(
        "revise <id>",
        new Command()
          .description("Request revision with review comments")
          .option("-c, --comment <comment:string>", "Review comment (can be specified multiple times)", {
            collect: true,
            required: true,
          })
          .action(async (options, ...args: string[]) => {
            const id = args[0] as unknown as string;
            try {
              await planCommands.revise(id, options.comment);
            } catch (error) {
              display.error("cli.error", "plan revise", {
                message: error instanceof Error ? error.message : "Unknown error",
              });
              Deno.exit(1);
            }
          }),
      ),
  )
  // Changeset commands
  .command(
    "changeset",
    new Command()
      .description("Review and manage agent-generated code changes")
      .command(
        "list",
        new Command()
          .description("List all pending changesets")
          .option("-s, --status <status:string>", "Filter by status (pending, approved, rejected)")
          .action(async (options) => {
            try {
              const changesets = await changesetCommands.list(options.status);
              if (changesets.length === 0) {
                display.info("changeset.list", "changesets", { count: 0, message: "No changesets found" });
                return;
              }
              display.info("changeset.list", "changesets", { count: changesets.length });
              for (const cs of changesets) {
                const statusEmoji = cs.status === "approved" ? "✅" : cs.status === "rejected" ? "❌" : "📌";
                const requestTitle = cs.request_title ? `"${cs.request_title}"` : cs.request_id;
                const planInfo = cs.plan_id ? `plan: ${cs.plan_id} (${cs.plan_status})` : "";
                const agentInfo = cs.request_agent || cs.agent_id;
                const portalInfo = cs.request_portal || cs.portal || "workspace";

                display.info(`${statusEmoji} ${cs.request_id}`, cs.branch, {
                  request: requestTitle,
                  plan: planInfo || undefined,
                  agent: agentInfo,
                  portal: portalInfo,
                  files: cs.files_changed,
                  created: new Date(cs.created_at).toLocaleString(),
                  trace: `${cs.trace_id.substring(0, 8)}...`,
                });
              }
            } catch (error) {
              display.error("cli.error", "changeset list", {
                message: error instanceof Error ? error.message : "Unknown error",
              });
              Deno.exit(1);
            }
          }),
      )
      .command(
        "show <id>",
        new Command()
          .description("Show changeset details including diff")
          .option("-d, --diff", "Show only the diff for the changeset")
          .action(async (options, ...args: string[]) => {
            const id = args[0] as unknown as string;
            try {
              const cs = await changesetCommands.show(id);

              if (options.diff) {
                // Output only the diff
                console.log(cs.diff);
              } else {
                // Output full details
                const statusEmoji = cs.status === "approved" ? "✅" : cs.status === "rejected" ? "❌" : "📌";
                const requestTitle = cs.request_title ? `"${cs.request_title}"` : "Untitled Request";
                const planInfo = cs.plan_id ? `${cs.plan_id} (${cs.plan_status})` : "unknown";
                const agentInfo = cs.request_agent || cs.agent_id;
                const portalInfo = cs.request_portal || cs.portal || "workspace";

                display.info(`${statusEmoji} changeset.show`, cs.request_id, {
                  branch: cs.branch,
                  status: cs.status || "pending",
                  request: requestTitle,
                  plan: planInfo,
                  agent: agentInfo,
                  portal: portalInfo,
                  priority: cs.request_priority || "normal",
                  created_by: cs.request_created_by || "unknown",
                  files_changed: cs.files_changed,
                  commits: cs.commits.length,
                  trace: cs.trace_id,
                });

                if (cs.approved_at) {
                  display.info("approved", new Date(cs.approved_at).toLocaleString(), {
                    by: cs.approved_by || "unknown",
                  });
                } else if (cs.rejected_at) {
                  display.info("rejected", new Date(cs.rejected_at).toLocaleString(), {
                    by: cs.rejected_by || "unknown",
                    reason: cs.rejection_reason || "no reason provided",
                  });
                }

                display.info("commits", "", {});
                for (const commit of cs.commits) {
                  display.info("commit", commit.sha.substring(0, 8), {
                    message: commit.message,
                    timestamp: new Date(commit.timestamp).toLocaleString(),
                  });
                }
                display.info("changeset.diff", id, { diff: cs.diff });
              }
            } catch (error) {
              display.error("cli.error", "changeset show", {
                message: error instanceof Error ? error.message : "Unknown error",
              });
              Deno.exit(1);
            }
          }),
      )
      .command(
        "approve <id>",
        new Command()
          .description("Approve changeset and merge to main")
          .action(async (_options, ...args: string[]) => {
            const id = args[0] as unknown as string;
            try {
              await changesetCommands.approve(id);
            } catch (error) {
              display.error("cli.error", "changeset approve", {
                message: error instanceof Error ? error.message : "Unknown error",
              });
              Deno.exit(1);
            }
          }),
      )
      .command(
        "reject <id>",
        new Command()
          .description("Reject changeset and delete branch")
          .option("-r, --reason <reason:string>", "Rejection reason (required)", { required: true })
          .action(async (options, ...args: string[]) => {
            const id = args[0] as unknown as string;
            try {
              await changesetCommands.reject(id, options.reason);
            } catch (error) {
              display.error("cli.error", "changeset reject", {
                message: error instanceof Error ? error.message : "Unknown error",
              });
              Deno.exit(1);
            }
          }),
      ),
  )
  // Git commands
  .command(
    "git",
    new Command()
      .description("Git repository operations")
      .command(
        "branches",
        new Command()
          .description("List all branches")
          .option("-p, --pattern <pattern:string>", "Filter by pattern (e.g., 'feat/*')")
          .action(async (options) => {
            try {
              const branches = await gitCommands.listBranches(options.pattern);
              display.info("git.branches", "repository", { count: branches.length });
              for (const branch of branches) {
                const current = branch.is_current ? "* " : "  ";
                display.info(`${current}${branch.name}`, branch.name, {
                  last_commit: `${branch.last_commit} (${new Date(branch.last_commit_date).toLocaleDateString()})`,
                  trace: branch.trace_id ? `${branch.trace_id.substring(0, 8)}...` : undefined,
                });
              }
            } catch (error) {
              display.error("cli.error", "git branches", {
                message: error instanceof Error ? error.message : "Unknown error",
              });
              Deno.exit(1);
            }
          }),
      )
      .command(
        "status",
        new Command()
          .description("Show repository status")
          .action(async () => {
            try {
              const status = await gitCommands.status();
              display.info("git.status", status.branch, {
                modified: status.modified.length > 0 ? status.modified : undefined,
                added: status.added.length > 0 ? status.added : undefined,
                deleted: status.deleted.length > 0 ? status.deleted : undefined,
                untracked: status.untracked.length > 0 ? status.untracked : undefined,
                clean: status.modified.length === 0 && status.added.length === 0 &&
                    status.deleted.length === 0 && status.untracked.length === 0
                  ? true
                  : undefined,
              });
            } catch (error) {
              display.error("cli.error", "git status", {
                message: error instanceof Error ? error.message : "Unknown error",
              });
              Deno.exit(1);
            }
          }),
      )
      .command(
        "log",
        new Command()
          .description("Search commit log by trace_id")
          .option("-t, --trace <trace_id:string>", "Filter by trace ID", { required: true })
          .action(async (options) => {
            try {
              const commits = await gitCommands.logByTraceId(options.trace);
              if (commits.length === 0) {
                display.info("git.log", options.trace, { count: 0, message: "No commits found" });
                return;
              }
              display.info("git.log", `${options.trace.substring(0, 8)}...`, { count: commits.length });
              for (const commit of commits) {
                display.info(commit.sha.substring(0, 8), commit.message, {
                  author: commit.author,
                  date: new Date(commit.date).toLocaleString(),
                });
              }
            } catch (error) {
              display.error("cli.error", "git log", {
                message: error instanceof Error ? error.message : "Unknown error",
              });
              Deno.exit(1);
            }
          }),
      ),
  )
  // Daemon commands
  .command(
    "daemon",
    new Command()
      .description("Control the ExoFrame daemon")
      .command(
        "start",
        new Command()
          .description("Start the ExoFrame daemon")
          .action(async () => {
            try {
              await daemonCommands.start();
            } catch (error) {
              display.error("cli.error", "daemon start", {
                message: error instanceof Error ? error.message : "Unknown error",
              });
              Deno.exit(1);
            }
          }),
      )
      .command(
        "stop",
        new Command()
          .description("Stop the ExoFrame daemon")
          .action(async () => {
            try {
              await daemonCommands.stop();
            } catch (error) {
              display.error("cli.error", "daemon stop", {
                message: error instanceof Error ? error.message : "Unknown error",
              });
              Deno.exit(1);
            }
          }),
      )
      .command(
        "restart",
        new Command()
          .description("Restart the ExoFrame daemon")
          .action(async () => {
            try {
              await daemonCommands.restart();
            } catch (error) {
              display.error("cli.error", "daemon restart", {
                message: error instanceof Error ? error.message : "Unknown error",
              });
              Deno.exit(1);
            }
          }),
      )
      .command(
        "status",
        new Command()
          .description("Check daemon status")
          .action(async () => {
            try {
              const status = await daemonCommands.status();
              display.info("daemon.status", "daemon", {
                version: status.version,
                status: status.running ? "Running ✓" : "Stopped ✗",
                pid: status.pid,
                uptime: status.uptime,
              });
            } catch (error) {
              display.error("cli.error", "daemon status", {
                message: error instanceof Error ? error.message : "Unknown error",
              });
              Deno.exit(1);
            }
          }),
      )
      .command(
        "logs",
        new Command()
          .description("Show daemon logs")
          .option("-n, --lines <lines:number>", "Number of lines to show", { default: CLI_DEFAULTS.LOG_LINES })
          .option("-f, --follow", "Follow log output")
          .action(async (options) => {
            try {
              await daemonCommands.logs(options.lines, options.follow);
            } catch (error) {
              display.error("cli.error", "daemon logs", {
                message: error instanceof Error ? error.message : "Unknown error",
              });
              Deno.exit(1);
            }
          }),
      ),
  )
  // Portal commands
  .command(
    "portal",
    new Command()
      .description("Manage external project portals")
      .command(
        "add <target-path> <alias>",
        new Command()
          .description("Add a new portal (symlink to external project)")
          .action(async (_options, ...args: string[]) => {
            const targetPath = args[0] as unknown as string;
            const alias = args[1] as unknown as string;
            try {
              await portalCommands.add(targetPath, alias);
            } catch (error) {
              display.error("cli.error", "portal add", {
                message: error instanceof Error ? error.message : "Unknown error",
              });
              Deno.exit(1);
            }
          }),
      )
      .command(
        "list",
        new Command()
          .description("List all configured portals")
          .action(async () => {
            try {
              const portals = await portalCommands.list();
              if (portals.length === 0) {
                display.info("portal.list", "portals", {
                  count: 0,
                  hint: "Add a portal with: exoctl portal add <path> <alias>",
                });
                return;
              }
              display.info("portal.list", "portals", { count: portals.length });
              for (const portal of portals) {
                display.info(portal.alias, portal.symlinkPath, {
                  status: portal.status === "active" ? "Active ✓" : "Broken ⚠",
                  target: portal.targetPath + (portal.status === "broken" ? " (not found)" : ""),
                  context: portal.contextCardPath,
                });
              }
            } catch (error) {
              display.error("cli.error", "portal list", {
                message: error instanceof Error ? error.message : "Unknown error",
              });
              Deno.exit(1);
            }
          }),
      )
      .command(
        "show <alias>",
        new Command()
          .description("Show detailed information about a portal")
          .action(async (_options, ...args: string[]) => {
            const alias = args[0] as unknown as string;
            try {
              const portal = await portalCommands.show(alias);
              display.info("portal.show", portal.alias, {
                target_path: portal.targetPath,
                symlink: portal.symlinkPath,
                status: portal.status === "active" ? "Active ✓" : "Broken ⚠",
                context_card: portal.contextCardPath,
                permissions: portal.permissions,
                created: portal.created,
                last_verified: portal.lastVerified,
              });
            } catch (error) {
              display.error("cli.error", "portal show", {
                message: error instanceof Error ? error.message : "Unknown error",
              });
              Deno.exit(1);
            }
          }),
      )
      .command(
        "remove <alias>",
        new Command()
          .description("Remove a portal (archives context card)")
          .option("--keep-card", "Keep context card instead of archiving")
          .action(async (options, ...args: string[]) => {
            const alias = args[0] as unknown as string;
            try {
              await portalCommands.remove(alias, { keepCard: options.keepCard });
            } catch (error) {
              display.error("cli.error", "portal remove", {
                message: error instanceof Error ? error.message : "Unknown error",
              });
              Deno.exit(1);
            }
          }),
      )
      .command(
        "verify",
        new Command()
          .description("Verify portal integrity")
          .arguments("[alias:string]")
          .action(async (_options, alias?: string) => {
            try {
              const results = await portalCommands.verify(alias);
              let healthy = 0;
              let broken = 0;
              for (const result of results) {
                if (result.issues && result.issues.length > 0) {
                  display.warn("portal.verify", result.alias, { status: "FAILED", issues: result.issues });
                  broken++;
                } else {
                  display.info("portal.verify", result.alias, { status: "OK" });
                  healthy++;
                }
              }
              display.info("portal.verify.summary", "portals", { healthy, broken });
            } catch (error) {
              display.error("cli.error", "portal verify", {
                message: error instanceof Error ? error.message : "Unknown error",
              });
              Deno.exit(1);
            }
          }),
      )
      .command(
        "refresh <alias>",
        new Command()
          .description("Refresh portal context card (re-scan project)")
          .action(async (_options, ...args: string[]) => {
            const alias = args[0] as unknown as string;
            try {
              await portalCommands.refresh(alias);
            } catch (error) {
              display.error("cli.error", "portal refresh", {
                message: error instanceof Error ? error.message : "Unknown error",
              });
              Deno.exit(1);
            }
          }),
      ),
  )
  // Blueprint commands
  .command(
    "blueprint",
    new Command()
      .description("Manage agent blueprints")
      .command(
        "create <agent-id>",
        new Command()
          .description("Create a new agent blueprint")
          .option("-n, --name <name:string>", "Agent name (required)")
          .option("-m, --model <model:string>", "Model in provider:model format (required)")
          .option("-d, --description <description:string>", "Brief description")
          .option("-c, --capabilities <capabilities:string>", "Comma-separated capabilities")
          .option("-p, --system-prompt <prompt:string>", "Inline system prompt")
          .option("-f, --system-prompt-file <file:string>", "Load system prompt from file")
          .option(
            "-t, --template <template:string>",
            "Template (default, coder, reviewer, architect, researcher, gemini, mock)",
          )
          .action(async (options, ...args: string[]) => {
            const agentId = args[0] as unknown as string;
            try {
              const result = await blueprintCommands.create(agentId, {
                name: options.name,
                model: options.model,
                description: options.description,
                capabilities: options.capabilities,
                systemPrompt: options.systemPrompt,
                systemPromptFile: options.systemPromptFile,
                template: options.template,
              });
              display.info("blueprint.created", result.agent_id, {
                name: result.name,
                model: result.model,
                path: result.path,
              });
            } catch (error) {
              display.error("cli.error", "blueprint create", {
                message: error instanceof Error ? error.message : "Unknown error",
              });
              Deno.exit(1);
            }
          }),
      )
      .command(
        "list",
        new Command()
          .description("List all agent blueprints")
          .action(async () => {
            try {
              const blueprints = await blueprintCommands.list();
              if (blueprints.length === 0) {
                display.info("blueprint.list", "blueprints", {
                  count: 0,
                  hint:
                    'Create a blueprint with: exoctl blueprint create <agent-id> --name "Name" --model "provider:model"',
                });
                return;
              }
              display.info("blueprint.list", "blueprints", { count: blueprints.length });
              for (const blueprint of blueprints) {
                display.info(blueprint.agent_id, blueprint.name, {
                  model: blueprint.model,
                  capabilities: blueprint.capabilities?.join(", ") || "general",
                  created: blueprint.created,
                });
              }
            } catch (error) {
              display.error("cli.error", "blueprint list", {
                message: error instanceof Error ? error.message : "Unknown error",
              });
              Deno.exit(1);
            }
          }),
      )
      .command(
        "show <agent-id>",
        new Command()
          .description("Show blueprint details")
          .action(async (_options, ...args: string[]) => {
            const agentId = args[0] as unknown as string;
            try {
              const blueprint = await blueprintCommands.show(agentId);
              display.info("blueprint.show", blueprint.agent_id, {
                name: blueprint.name,
                model: blueprint.model,
                capabilities: blueprint.capabilities?.join(", ") || "general",
                version: blueprint.version,
                created: blueprint.created,
                created_by: blueprint.created_by,
                content_preview: blueprint.content.substring(0, 200) + "...",
              });
            } catch (error) {
              display.error("cli.error", "blueprint show", {
                message: error instanceof Error ? error.message : "Unknown error",
              });
              Deno.exit(1);
            }
          }),
      )
      .command(
        "validate <agent-id>",
        new Command()
          .description("Validate blueprint format")
          .action(async (_options, ...args: string[]) => {
            const agentId = args[0] as unknown as string;
            try {
              const result = await blueprintCommands.validate(agentId);
              if (result.valid) {
                display.info("blueprint.valid", agentId, {
                  status: "Valid ✓",
                  warnings: result.warnings?.length || 0,
                });
              } else {
                display.error("blueprint.invalid", agentId, {
                  status: "Invalid ✗",
                  errors: result.errors,
                });
                Deno.exit(1);
              }
            } catch (error) {
              display.error("cli.error", "blueprint validate", {
                message: error instanceof Error ? error.message : "Unknown error",
              });
              Deno.exit(1);
            }
          }),
      )
      .command(
        "edit <agent-id>",
        new Command()
          .description("Edit blueprint in $EDITOR")
          .action(async (_options, ...args: string[]) => {
            const agentId = args[0] as unknown as string;
            try {
              await blueprintCommands.edit(agentId);
            } catch (error) {
              display.error("cli.error", "blueprint edit", {
                message: error instanceof Error ? error.message : "Unknown error",
              });
              Deno.exit(1);
            }
          }),
      )
      .command(
        "remove <agent-id>",
        new Command()
          .description("Remove a blueprint")
          .option("--force", "Skip confirmation")
          .action(async (options, ...args: string[]) => {
            const agentId = args[0] as unknown as string;
            try {
              await blueprintCommands.remove(agentId, { force: options.force });
              display.info("blueprint.removed", agentId, { status: "Removed ✓" });
            } catch (error) {
              display.error("cli.error", "blueprint remove", {
                message: error instanceof Error ? error.message : "Unknown error",
              });
              Deno.exit(1);
            }
          }),
      )
      .command(
        "ls",
        new Command().description("Alias for 'list'").action(async () => {
          const blueprints = await blueprintCommands.list();
          if (blueprints.length === 0) {
            display.info("blueprint.list", "blueprints", { count: 0 });
            return;
          }
          display.info("blueprint.list", "blueprints", { count: blueprints.length });
          for (const blueprint of blueprints) {
            display.info(blueprint.agent_id, blueprint.name, {
              model: blueprint.model,
              capabilities: blueprint.capabilities?.join(", ") || "general",
            });
          }
        }),
      )
      .command(
        "rm <agent-id>",
        new Command().description("Alias for 'remove'").option("--force", "Skip confirmation").action(
          async (options, ...args: string[]) => {
            const agentId = args[0] as unknown as string;
            await blueprintCommands.remove(agentId, { force: options.force });
            display.info("blueprint.removed", agentId, { status: "Removed ✓" });
          },
        ),
      ),
  )
  // Flow commands
  .command(
    "flow",
    new Command()
      .description("Manage and execute ExoFrame flows")
      .command(
        "list",
        new Command()
          .description("List all available flows")
          .option("--json", "Output in JSON format")
          .action(async (options) => {
            await flowCommands.listFlows(options);
          }),
      )
      .command(
        "show <flowId:string>",
        new Command()
          .description("Show details of a specific flow")
          .option("--json", "Output in JSON format")
          .action(async (options, ...args: string[]) => {
            const flowId = args[0] as unknown as string;
            await flowCommands.showFlow(flowId, options);
          }),
      )
      .command(
        "validate <flowId:string>",
        new Command()
          .description("Validate a flow definition")
          .option("--json", "Output in JSON format")
          .action(async (options, ...args: string[]) => {
            const flowId = args[0] as unknown as string;
            await flowCommands.validateFlow(flowId, options);
          }),
      ),
  )
  // Memory commands
  .command(
    "memory",
    new Command()
      .description("Manage Memory Banks (project memory, execution history, search)")
      .option("--format <format:string>", "Output format: table, json, md", { default: "table" })
      .action(async (options) => {
        // Default action: show summary
        const result = await memoryCommands.list(options.format as "table" | "json" | "md");
        console.log(result);
      })
      .command(
        "list",
        new Command()
          .description("List all memory banks with summary")
          .option("--format <format:string>", "Output format: table, json, md", { default: "table" })
          .action(async (options) => {
            const result = await memoryCommands.list(options.format as "table" | "json" | "md");
            console.log(result);
          }),
      )
      .command(
        "search <query:string>",
        new Command()
          .description("Search across all memory banks")
          .option("-p, --portal <portal:string>", "Filter by portal")
          .option("-t, --tags <tags:string>", "Filter by tags (comma-separated)")
          .option("-l, --limit <limit:number>", "Maximum results", { default: 20 })
          .option("-e, --use-embeddings", "Use embedding-based semantic search")
          .option("--format <format:string>", "Output format: table, json, md", { default: "table" })
          .action(async (options, ...args: string[]) => {
            const query = args[0] as unknown as string;
            const tags = options.tags ? options.tags.split(",").map((t: string) => t.trim()) : undefined;
            const result = await memoryCommands.search(query, {
              portal: options.portal,
              tags,
              limit: options.limit,
              format: options.format as "table" | "json" | "md",
              useEmbeddings: options.useEmbeddings,
            });
            console.log(result);
          }),
      )
      .command(
        "project",
        new Command()
          .description("Project memory operations")
          .option("--format <format:string>", "Output format: table, json, md", { default: "table" })
          .action(async (options) => {
            // Default: list projects
            const result = await memoryCommands.projectList(options.format as "table" | "json" | "md");
            console.log(result);
          })
          .command(
            "list",
            new Command()
              .description("List all project memories")
              .option("--format <format:string>", "Output format: table, json, md", { default: "table" })
              .action(async (options) => {
                const result = await memoryCommands.projectList(options.format as "table" | "json" | "md");
                console.log(result);
              }),
          )
          .command(
            "show <portal:string>",
            new Command()
              .description("Show details of a specific project memory")
              .option("--format <format:string>", "Output format: table, json, md", { default: "table" })
              .action(async (options, ...args: string[]) => {
                const portal = args[0] as unknown as string;
                const result = await memoryCommands.projectShow(portal, options.format as "table" | "json" | "md");
                console.log(result);
              }),
          ),
      )
      .command(
        "execution",
        new Command()
          .description("Execution history operations")
          .option("-p, --portal <portal:string>", "Filter by portal")
          .option("-l, --limit <limit:number>", "Maximum results", { default: 20 })
          .option("--format <format:string>", "Output format: table, json, md", { default: "table" })
          .action(async (options) => {
            // Default: list executions
            const result = await memoryCommands.executionList({
              portal: options.portal,
              limit: options.limit,
              format: options.format as "table" | "json" | "md",
            });
            console.log(result);
          })
          .command(
            "list",
            new Command()
              .description("List execution history")
              .option("-p, --portal <portal:string>", "Filter by portal")
              .option("-l, --limit <limit:number>", "Maximum results", { default: 20 })
              .option("--format <format:string>", "Output format: table, json, md", { default: "table" })
              .action(async (options) => {
                const result = await memoryCommands.executionList({
                  portal: options.portal,
                  limit: options.limit,
                  format: options.format as "table" | "json" | "md",
                });
                console.log(result);
              }),
          )
          .command(
            "show <traceId:string>",
            new Command()
              .description("Show details of a specific execution")
              .option("--format <format:string>", "Output format: table, json, md", { default: "table" })
              .action(async (options, ...args: string[]) => {
                const traceId = args[0] as unknown as string;
                const result = await memoryCommands.executionShow(traceId, options.format as "table" | "json" | "md");
                console.log(result);
              }),
          ),
      )
      .command(
        "rebuild-index",
        new Command()
          .description("Rebuild memory bank search indices")
          .option("-e, --include-embeddings", "Regenerate embedding vectors for all learnings")
          .action(async (options) => {
            const result = await memoryCommands.rebuildIndex({
              includeEmbeddings: options.includeEmbeddings,
            });
            console.log(result);
          }),
      )
      .command(
        "pending",
        new Command()
          .description("Manage pending memory update proposals")
          .option("--format <format:string>", "Output format: table, json, md", { default: "table" })
          .action(async (options) => {
            // Default: list pending
            const result = await memoryCommands.pendingList(options.format as "table" | "json" | "md");
            console.log(result);
          })
          .command(
            "list",
            new Command()
              .description("List all pending proposals")
              .option("--format <format:string>", "Output format: table, json, md", { default: "table" })
              .action(async (options) => {
                const result = await memoryCommands.pendingList(options.format as "table" | "json" | "md");
                console.log(result);
              }),
          )
          .command(
            "show <proposalId:string>",
            new Command()
              .description("Show details of a pending proposal")
              .option("--format <format:string>", "Output format: table, json, md", { default: "table" })
              .action(async (options, ...args: string[]) => {
                const proposalId = args[0] as unknown as string;
                const result = await memoryCommands.pendingShow(proposalId, options.format as "table" | "json" | "md");
                console.log(result);
              }),
          )
          .command(
            "approve <proposalId:string>",
            new Command()
              .description("Approve a pending proposal")
              .action(async (_options, ...args: string[]) => {
                const proposalId = args[0] as unknown as string;
                const result = await memoryCommands.pendingApprove(proposalId);
                console.log(result);
              }),
          )
          .command(
            "reject <proposalId:string>",
            new Command()
              .description("Reject a pending proposal")
              .option("-r, --reason <reason:string>", "Rejection reason", { required: true })
              .action(async (options, ...args: string[]) => {
                const proposalId = args[0] as unknown as string;
                const result = await memoryCommands.pendingReject(proposalId, options.reason);
                console.log(result);
              }),
          )
          .command(
            "approve-all",
            new Command()
              .description("Approve all pending proposals")
              .action(async () => {
                const result = await memoryCommands.pendingApproveAll();
                console.log(result);
              }),
          ),
      )
      // Phase 17: Skill commands
      .command(
        "skill",
        new Command()
          .description("Manage procedural skills (Phase 17)")
          .option("--format <format:string>", "Output format: table, json, md", { default: "table" })
          .action(async (options) => {
            // Default: list skills
            const result = await memoryCommands.skillList({ format: options.format as "table" | "json" | "md" });
            console.log(result);
          })
          .command(
            "list",
            new Command()
              .description("List all skills")
              .option("-c, --category <category:string>", "Filter by category: core, project, learned")
              .option("--format <format:string>", "Output format: table, json, md", { default: "table" })
              .action(async (options) => {
                const result = await memoryCommands.skillList({
                  category: options.category as "core" | "project" | "learned" | undefined,
                  format: options.format as "table" | "json" | "md",
                });
                console.log(result);
              }),
          )
          .command(
            "show <skillId:string>",
            new Command()
              .description("Show details of a specific skill")
              .option("--format <format:string>", "Output format: table, json, md", { default: "table" })
              .action(async (options, ...args: string[]) => {
                const skillId = args[0] as unknown as string;
                const result = await memoryCommands.skillShow(skillId, options.format as "table" | "json" | "md");
                console.log(result);
              }),
          )
          .command(
            "match <request:string>",
            new Command()
              .description("Match skills for a given request")
              .option("-t, --task-type <taskType:string>", "Task type filter")
              .option("--tags <tags:string>", "Comma-separated tags filter")
              .option("-l, --limit <limit:number>", "Maximum results", { default: 10 })
              .option("--format <format:string>", "Output format: table, json, md", { default: "table" })
              .action(async (options, ...args: string[]) => {
                const request = args[0] as unknown as string;
                const tags = options.tags ? options.tags.split(",").map((t: string) => t.trim()) : undefined;
                const result = await memoryCommands.skillMatch(request, {
                  taskType: options.taskType,
                  tags,
                  limit: options.limit,
                  format: options.format as "table" | "json" | "md",
                });
                console.log(result);
              }),
          )
          .command(
            "derive",
            new Command()
              .description("Derive a new skill from learnings")
              .option("-l, --learning-ids <ids:string>", "Comma-separated learning IDs to derive from", {
                required: true,
              })
              .option("-n, --name <name:string>", "Name for the derived skill", { required: true })
              .option("-d, --description <desc:string>", "Skill description")
              .option("-i, --instructions <instructions:string>", "Skill instructions")
              .option("--format <format:string>", "Output format: table, json, md", { default: "table" })
              .action(async (options) => {
                const learningIds = options.learningIds
                  ? options.learningIds.split(",").map((id: string) => id.trim())
                  : undefined;
                const result = await memoryCommands.skillDerive({
                  learningIds,
                  name: options.name,
                  description: options.description,
                  instructions: options.instructions,
                  format: options.format as "table" | "json" | "md",
                });
                console.log(result);
              }),
          )
          .command(
            "create <name:string>",
            new Command()
              .description("Create a new skill")
              .option("-d, --description <desc:string>", "Skill description")
              .option("-c, --category <category:string>", "Category: core, project, learned", { default: "project" })
              .option("-i, --instructions <instructions:string>", "Skill instructions")
              .option("-k, --keywords <keywords:string>", "Comma-separated trigger keywords")
              .option("-t, --task-types <taskTypes:string>", "Comma-separated trigger task types")
              .option("--format <format:string>", "Output format: table, json, md", { default: "table" })
              .action(async (options, ...args: string[]) => {
                const name = args[0] as unknown as string;
                const keywords = options.keywords
                  ? options.keywords.split(",").map((k: string) => k.trim())
                  : undefined;
                const taskTypes = options.taskTypes
                  ? options.taskTypes.split(",").map((t: string) => t.trim())
                  : undefined;
                const result = await memoryCommands.skillCreate(name, {
                  description: options.description,
                  category: options.category as "core" | "project" | "learned",
                  instructions: options.instructions,
                  triggersKeywords: keywords,
                  triggersTaskTypes: taskTypes,
                  format: options.format as "table" | "json" | "md",
                });
                console.log(result);
              }),
          ),
      ),
  )
  .command(
    "dashboard",
    new Command()
      .description("Launch the interactive dashboard")
      .action(async () => {
        await dashboardCommands.show();
      }),
  )
  .command(
    "mcp",
    new Command()
      .description("Model Context Protocol server")
      .command(
        "start",
        new Command()
          .description("Start MCP server (stdio transport)")
          .option("--sse", "Use SSE/HTTP transport (default: stdio)")
          .option("--port <port:number>", "Port for SSE transport", { default: 3000 })
          .action(async (options) => {
            const cmd = new McpCommands(context);
            await cmd.start(options);
          }),
      ),
  );

// Helper function for printing request results
import type { RequestMetadata } from "./request_commands.ts";

function printRequestResult(result: RequestMetadata, json: boolean, _dryRun: boolean) {
  if (json) {
    display.info("cli.output", "request", { data: JSON.stringify(result, null, 2) });
  } else {
    display.info("request.created", result.filename, {
      trace_id: result.trace_id,
      priority: result.priority,
      agent: result.flow ? undefined : result.agent,
      flow: result.flow,
      path: result.path,
      next: "Daemon will process this automatically",
    });
  }
}

const journalCommand = new Command()
  .description("Query the Activity Journal")
  .option("-f, --filter <filter:string[]>", "Filter by key=value (trace_id, action_type, agent_id, since)", {
    collect: true,
  })
  .option("-n, --tail <n:number>", "Show last N entries", { default: 50 })
  .option("--format <format:string>", "Output format (text, table, json)", { default: "text" })
  .option("--distinct <field:string>", "Return distinct values for specified field")
  .option("--count", "Return count aggregation by action_type")
  .option("--payload <pattern:string>", "Filter by payload LIKE pattern")
  .option("--actor <actor:string>", "Filter by actor")
  .option("--target <target:string>", "Filter by target")
  .action(async (options: any) => {
    const cmd = new JournalCommands(context);
    await cmd.show(options);
  });

__test_command.command("journal", journalCommand);

if (!isTestMode()) {
  await __test_command.parse(Deno.args);
}
