import type { PaperclipPluginManifestV1 } from "@paperclipai/plugin-sdk";
import { EXPORT_NAMES, PLUGIN_ID, PLUGIN_VERSION, SLOT_IDS } from "./constants.js";

const manifest: PaperclipPluginManifestV1 = {
  id: PLUGIN_ID,
  apiVersion: 1,
  version: PLUGIN_VERSION,
  displayName: "Paperclip AI2AI Plugin",
  description: "Dispatch Paperclip work over AI2AI and track returned results.",
  author: "Darren Edwards",
  categories: ["connector", "automation", "ui"],
  capabilities: [
    "issues.read",
    "issues.update",
    "issue.comments.read",
    "issue.comments.create",
    "plugin.state.read",
    "plugin.state.write",
    "events.subscribe",
    "ui.detailTab.register",
    "ui.dashboardWidget.register",
    "ui.action.register"
  ],
  entrypoints: {
    worker: "./dist/worker.js",
    ui: "./dist/ui"
  },
  instanceConfigSchema: {
    type: "object",
    properties: {
      ai2aiEndpoint: { type: "string", title: "AI2AI Endpoint", default: "http://localhost:18811/ai2ai" },
      recipientAgent: { type: "string", title: "Recipient Agent", default: "alex-assistant" },
      recipientHuman: { type: "string", title: "Recipient Human", default: "Alex" },
      recipientNode: { type: "string", title: "Recipient Node", default: "unknown" },
      responseInboxDir: { type: "string", title: "Response Inbox Directory", default: "/home/darre/.openclaw/workspace/ai2ai-protocol/paperclip-inbox" },
      liveStatusDir: { type: "string", title: "Live Status Directory", default: "/home/darre/.openclaw/workspace/ai2ai-protocol/paperclip-live" }
    }
  },
  ui: {
    slots: [
      {
        type: "dashboardWidget",
        id: SLOT_IDS.dashboardWidget,
        displayName: "AI2AI Bridge",
        exportName: EXPORT_NAMES.dashboardWidget
      },
      {
        type: "detailTab",
        id: SLOT_IDS.issueTab,
        displayName: "AI2AI",
        exportName: EXPORT_NAMES.issueTab,
        entityTypes: ["issue"]
      },
      {
        type: "taskDetailView",
        id: SLOT_IDS.taskDetailView,
        displayName: "AI2AI Task View",
        exportName: EXPORT_NAMES.taskDetailView,
        entityTypes: ["issue"]
      }
    ]
  }
};

export default manifest;
