/**
 * Key handler utilities for Agent Status View
 * Extracted from agent_status_view.ts to reduce complexity
 */

import {
  KEY_A,
  KEY_C,
  KEY_CAPITAL_E,
  KEY_CAPITAL_R,
  KEY_DOWN,
  KEY_END,
  KEY_ENTER,
  KEY_ESCAPE,
  KEY_G,
  KEY_HOME,
  KEY_LEFT,
  KEY_Q,
  KEY_QUESTION,
  KEY_RIGHT,
  KEY_S,
  KEY_UP,
} from "../../config/constants.ts";

/**
 * Handle view mode keys (detail, logs, help)
 */
export class ViewModeHandler {
  static handleKey(
    key: string,
    viewState: {
      showDetail: boolean;
      showLogs: boolean;
      showHelp: boolean;
    },
    actions: {
      hideDetail: () => void;
      hideLogs: () => void;
      toggleHelp: () => void;
    },
  ): boolean {
    // Handle detail view
    if (viewState.showDetail) {
      if (key === KEY_ESCAPE || key === KEY_Q) {
        actions.hideDetail();
      }
      return true;
    }

    // Handle logs view
    if (viewState.showLogs) {
      if (key === KEY_ESCAPE || key === KEY_Q) {
        actions.hideLogs();
      }
      return true;
    }

    // Handle help view
    if (viewState.showHelp) {
      if (key === KEY_ESCAPE || key === KEY_Q || key === KEY_QUESTION) {
        actions.toggleHelp();
      }
      return true;
    }

    return false;
  }
}

/**
 * Handle main view navigation and action keys
 */
export class MainViewHandler {
  static async handleKey(
    key: string,
    actions: {
      navigateUp?: () => void;
      navigateDown?: () => void;
      navigateToFirst?: () => void;
      navigateToLast?: () => void;
      collapseSelected?: () => void;
      expandSelected?: () => void;
      showAgentDetail?: () => Promise<void>;
      showAgentLogs?: () => Promise<void>;
      showSearchDialog?: () => void;
      toggleGrouping?: () => void;
      refreshAgents?: () => Promise<void>;
      toggleAutoRefresh?: () => void;
      collapseAllNodes?: () => void;
      expandAllNodes?: () => void;
      toggleHelp?: () => void;
    },
  ): Promise<boolean> {
    switch (key) {
      case KEY_UP:
        if (actions.navigateUp) actions.navigateUp();
        return true;
      case KEY_DOWN:
        if (actions.navigateDown) actions.navigateDown();
        return true;
      case KEY_HOME:
        if (actions.navigateToFirst) actions.navigateToFirst();
        return true;
      case KEY_END:
        if (actions.navigateToLast) actions.navigateToLast();
        return true;
      case KEY_LEFT:
        if (actions.collapseSelected) actions.collapseSelected();
        return true;
      case KEY_RIGHT:
        if (actions.expandSelected) actions.expandSelected();
        return true;
      case KEY_ENTER:
        if (actions.showAgentDetail) await actions.showAgentDetail();
        return true;
      case "l":
        if (actions.showAgentLogs) await actions.showAgentLogs();
        return true;
      case KEY_S:
        if (actions.showSearchDialog) actions.showSearchDialog();
        return true;
      case KEY_G:
        if (actions.toggleGrouping) actions.toggleGrouping();
        return true;
      case KEY_CAPITAL_R:
        if (actions.refreshAgents) await actions.refreshAgents();
        return true;
      case KEY_A:
        if (actions.toggleAutoRefresh) actions.toggleAutoRefresh();
        return true;
      case KEY_C:
        if (actions.collapseAllNodes) actions.collapseAllNodes();
        return true;
      case KEY_CAPITAL_E:
        if (actions.expandAllNodes) actions.expandAllNodes();
        return true;
      case KEY_QUESTION:
        if (actions.toggleHelp) actions.toggleHelp();
        return true;
    }
    return false;
  }
}
