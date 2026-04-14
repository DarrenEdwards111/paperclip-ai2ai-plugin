import {
  usePluginAction,
  usePluginData,
  type PluginDetailTabProps,
  type PluginWidgetProps,
} from "@paperclipai/plugin-sdk/ui";
import { ACTION_KEYS, DATA_KEYS } from "../constants.js";
import type { BridgeLiveTask, BridgeRecord } from "../types.js";

type HealthData = {
  status: string;
  checkedAt: string;
  pluginId: string;
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

function StatusPill({ status }: { status?: string }) {
  const color =
    status === "completed" ? "#1b7f3b"
      : status === "failed" ? "#b42318"
      : status === "running" ? "#175cd3"
      : status === "queued" || status === "dispatched" ? "#b54708"
      : "#475467";

  return (
    <span style={{
      display: "inline-block",
      padding: "0.15rem 0.5rem",
      borderRadius: 999,
      background: color,
      color: "white",
      fontSize: "0.8rem",
      fontWeight: 600,
    }}>
      {status ?? "unknown"}
    </span>
  );
}

function LiveTaskPanel({ liveTask }: { liveTask?: BridgeLiveTask }) {
  if (!liveTask) return <div>No live task data yet.</div>;

  return (
    <div style={{ display: "grid", gap: "0.4rem", padding: "0.75rem", border: "1px solid #ddd", borderRadius: 8 }}>
      <div><strong>Live runtime</strong> <StatusPill status={liveTask.status} /></div>
      {liveTask.command ? <div>Command: <code>{liveTask.command}</code></div> : null}
      {liveTask.cwd ? <div>CWD: <code>{liveTask.cwd}</code></div> : null}
      {liveTask.taskId ? <div>Task ID: <code>{liveTask.taskId}</code></div> : null}
      {liveTask.startedAt ? <div>Started: {liveTask.startedAt}</div> : null}
      {liveTask.finishedAt ? <div>Finished: {liveTask.finishedAt}</div> : null}
      <div>Updated: {liveTask.updatedAt}</div>
      {liveTask.logPath ? <div>Log path: <code>{liveTask.logPath}</code></div> : null}
      {liveTask.logTail ? (
        <div>
          <div style={{ marginBottom: "0.25rem" }}>Recent output:</div>
          <pre style={{ whiteSpace: "pre-wrap", maxHeight: 220, overflow: "auto", margin: 0 }}>{liveTask.logTail}</pre>
        </div>
      ) : null}
      {liveTask.error ? <div style={{ color: "#b42318" }}>Error: {liveTask.error}</div> : null}
    </div>
  );
}

function IssueBridgePanel({ context }: PluginDetailTabProps) {
  const { data, loading, error, refresh } = usePluginData<BridgeRecord>(DATA_KEYS.issueBridgeState, {
    issueId: context.entityId,
  });
  const { data: liveTask } = usePluginData<BridgeLiveTask>(DATA_KEYS.liveTaskStatus, {
    issueId: context.entityId,
  });
  const dispatch = usePluginAction(ACTION_KEYS.dispatchClaudeTask);
  const syncPending = usePluginAction(ACTION_KEYS.syncPendingResponses);
  const syncLive = usePluginAction(ACTION_KEYS.syncLiveTaskStatus);

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

  async function handleRefresh() {
    await syncLive({ issueId: context.entityId });
    await syncPending();
    await refresh();
  }

  if (loading) return <div>Loading bridge state...</div>;
  if (error) return <div>Error: {error.message}</div>;

  return (
    <div style={{ display: "grid", gap: "0.75rem" }}>
      <strong>AI2AI Issue Bridge</strong>
      <div>Status: <StatusPill status={data?.status} /></div>
      <div>Updated: {data?.updatedAt ?? "never"}</div>
      {data?.request ? (
        <div>
          <div>Target: {data.request.to.agent}</div>
          <div>Endpoint: {data.request.endpoint}</div>
          {data.request.cwd ? <div>CWD: <code>{data.request.cwd}</code></div> : null}
        </div>
      ) : null}
      {data?.error ? <div style={{ color: "red" }}>Error: {data.error}</div> : null}
      <LiveTaskPanel liveTask={liveTask ?? data?.liveTask} />
      {data?.response ? (
        <details>
          <summary>Latest response payload</summary>
          <pre style={{ whiteSpace: "pre-wrap" }}>{JSON.stringify(data.response, null, 2)}</pre>
        </details>
      ) : null}
      <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
        <button onClick={() => void handleDispatch()}>Dispatch dev.claude_task</button>
        <button onClick={() => void handleRefresh()}>Refresh live status</button>
      </div>
    </div>
  );
}

export function IssueTab(props: PluginDetailTabProps) {
  return <IssueBridgePanel {...props} />;
}

export function TaskDetailView(props: PluginDetailTabProps) {
  return <IssueBridgePanel {...props} />;
}
