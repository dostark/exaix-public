import { BaseCommand, type CommandContext } from "./base.ts";
import { launchTuiDashboard } from "../tui/tui_dashboard.ts";

export type LaunchDashboardFn = typeof launchTuiDashboard;

export class DashboardCommands extends BaseCommand {
  private launchDashboard: LaunchDashboardFn;

  constructor(context: CommandContext) {
    super(context);

    this.launchDashboard = launchTuiDashboard;
  }

  static create(context: CommandContext, deps?: { launchDashboard?: LaunchDashboardFn }): DashboardCommands {
    const commands = new DashboardCommands(context);
    if (deps?.launchDashboard) {
      commands.launchDashboard = deps.launchDashboard;
    }
    return commands;
  }

  async show(): Promise<void> {
    await this.launchDashboard({
      databaseService: this.db,
    });
  }
}
