export type BridgeLiveTask = {
  taskId?: string;
  status: "idle" | "queued" | "running" | "completed" | "failed";
  cwd?: string;
  command?: string;
  startedAt?: string;
  updatedAt: string;
  finishedAt?: string;
  logPath?: string;
  logTail?: string;
  source?: string;
  error?: string;
};

export type BridgeRecord = {
  issueId: string;
  status: "idle" | "dispatched" | "running" | "completed" | "failed";
  updatedAt: string;
  request?: {
    endpoint: string;
    to: { agent: string; human: string; node: string };
    task: string;
    cwd?: string;
    conversationId?: string;
  };
  response?: Record<string, unknown>;
  liveTask?: BridgeLiveTask;
  error?: string;
};
