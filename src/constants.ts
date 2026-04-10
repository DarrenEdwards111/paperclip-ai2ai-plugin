export const PLUGIN_ID = "paperclip-ai2ai-plugin";
export const PLUGIN_VERSION = "0.1.0";
export const PAGE_ROUTE = "ai2ai";

export const SLOT_IDS = {
  dashboardWidget: "ai2ai-dashboard-widget",
  issueTab: "ai2ai-issue-tab",
  taskDetailView: "ai2ai-task-detail-view",
} as const;

export const EXPORT_NAMES = {
  dashboardWidget: "DashboardWidget",
  issueTab: "IssueTab",
  taskDetailView: "TaskDetailView",
} as const;

export const DATA_KEYS = {
  health: "health",
  issueBridgeState: "issue-bridge-state",
} as const;

export const ACTION_KEYS = {
  dispatchClaudeTask: "dispatch-claude-task",
  ingestResponse: "ingest-response",
  syncPendingResponses: "sync-pending-responses",
} as const;

export const STATE_KEYS = {
  bridge: "bridge",
  ai2aiConversation: "ai2ai-conversation",
} as const;
