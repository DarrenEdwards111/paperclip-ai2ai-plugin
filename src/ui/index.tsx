import {
  usePluginAction,
  usePluginData,
  type PluginDetailTabProps,
  type PluginWidgetProps,
} from "@paperclipai/plugin-sdk/ui";
import { ACTION_KEYS, DATA_KEYS } from "../constants.js";

type HealthData = {
  status: string;
  checkedAt: string;
  pluginId: string;
};

type BridgeState = {
  issueId: string;
  status: string;
  updatedAt: string;
  request?: {
    endpoint: string;
    to: { agent: string; human: string; node: string };
    task: string;
  };
  response?: Record<string, unknown>;
  error?: string;
};

export function DashboardWidget(_props: PluginWidgetProps) {
  const { data, loading, error } = usePluginData<HealthData>(DATA_KEYS.health);

  if (loading) return <div>Loading AI2AI bridge health...</div>;
  if (error) return <div>Plugin error: {error.message}</div>;

  return (
    <div style={{ display: "grid", gap: "0.5rem" }}>
      <strong>Paperclip AI2AI Plugin</strong>
      <div>Status: {data?.status ?? "unknown"}</div>
      <div>Checked: {data?.checkedAt ?? "never"}</div>
      <div>Plugin: {data?.pluginId ?? "unknown"}</div>
    </div>
  );
}

function IssueBridgePanel({ context }: PluginDetailTabProps) {
  const { data, loading, error, refresh } = usePluginData<BridgeState>(DATA_KEYS.issueBridgeState, {
    issueId: context.entityId,
  });
  const dispatch = usePluginAction(ACTION_KEYS.dispatchClaudeTask);

  async function handleDispatch() {
    await dispatch({
      issueId: context.entityId,
      companyId: context.companyId,
      endpoint: "http://localhost:18811/ai2ai",
      agent: "alex-assistant",
      human: "Alex",
      node: "unknown",
    });
    await refresh();
  }

  if (loading) return <div>Loading bridge state...</div>;
  if (error) return <div>Error: {error.message}</div>;

  return (
    <div style={{ display: "grid", gap: "0.75rem" }}>
      <strong>AI2AI Issue Bridge</strong>
      <div>Status: {data?.status ?? "idle"}</div>
      <div>Updated: {data?.updatedAt ?? "never"}</div>
      {data?.request ? (
        <div>
          <div>Target: {data.request.to.agent}</div>
          <div>Endpoint: {data.request.endpoint}</div>
        </div>
      ) : null}
      {data?.error ? <div style={{ color: "red" }}>Error: {data.error}</div> : null}
      <button onClick={() => void handleDispatch()}>Dispatch dev.claude_task</button>
    </div>
  );
}

export function IssueTab(props: PluginDetailTabProps) {
  return <IssueBridgePanel {...props} />;
}

export function TaskDetailView(props: PluginDetailTabProps) {
  return <IssueBridgePanel {...props} />;
}
