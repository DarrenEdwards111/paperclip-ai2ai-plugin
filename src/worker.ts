import fs from "node:fs/promises";
import path from "node:path";
import { createRequire } from "node:module";
import { definePlugin, runWorker } from "@paperclipai/plugin-sdk";
import { ACTION_KEYS, DATA_KEYS, PLUGIN_ID, STATE_KEYS } from "./constants.js";

const require = createRequire(import.meta.url);
const ai2aiClient = require("../../skills/ai2ai/ai2ai-client.js") as {
  createEnvelope: (input: Record<string, unknown>) => Record<string, unknown>;
  sendMessage: (endpoint: string, envelope: Record<string, unknown>, options?: Record<string, unknown>) => Promise<unknown>;
};

type BridgeRecord = {
  issueId: string;
  status: "idle" | "dispatched" | "completed" | "failed";
  updatedAt: string;
  request?: {
    endpoint: string;
    to: { agent: string; human: string; node: string };
    task: string;
    cwd?: string;
    conversationId?: string;
  };
  response?: Record<string, unknown>;
  error?: string;
};

type PluginConfig = {
  ai2aiEndpoint?: string;
  recipientAgent?: string;
  recipientHuman?: string;
  recipientNode?: string;
  responseInboxDir?: string;
};

function now() {
  return new Date().toISOString();
}

function bridgeScope(issueId: string) {
  return { scopeKind: "issue" as const, scopeId: issueId, stateKey: STATE_KEYS.bridge };
}

function conversationScope(conversationId: string) {
  return { scopeKind: "instance" as const, stateKey: `${STATE_KEYS.ai2aiConversation}:${conversationId}` };
}

async function getBridgeState(ctx: any, issueId: string): Promise<BridgeRecord> {
  return (await ctx.state.get(bridgeScope(issueId))) ?? {
    issueId,
    status: "idle",
    updatedAt: now(),
  };
}

async function setBridgeState(ctx: any, record: BridgeRecord) {
  await ctx.state.set(bridgeScope(record.issueId), record);
}

async function getConfig(ctx: any): Promise<PluginConfig> {
  return (await ctx.config.get()) as PluginConfig;
}

function getInboxDir(config: PluginConfig) {
  return config.responseInboxDir || path.resolve("/home/darre/.openclaw/workspace/ai2ai-protocol/paperclip-inbox");
}

async function storeConversationMapping(ctx: any, conversationId: string, issueId: string, companyId: string) {
  await ctx.state.set(conversationScope(conversationId), { issueId, companyId, updatedAt: now() });
}

async function lookupConversationMapping(ctx: any, conversationId: string): Promise<{ issueId: string; companyId: string } | null> {
  return (await ctx.state.get(conversationScope(conversationId))) ?? null;
}

function buildAi2AiCommandEnvelope(task: string, extras: Record<string, unknown> = {}) {
  return {
    kind: "ai2ai.command",
    version: "1",
    command: "dev.claude_task",
    instructions: task,
    ...extras,
  };
}

function extractAi2AiCommandEnvelope(payload: Record<string, unknown>) {
  const commandEnvelope = payload?.commandEnvelope;
  if (!commandEnvelope || typeof commandEnvelope !== "object") return null;
  const record = commandEnvelope as Record<string, unknown>;
  if (record.kind !== "ai2ai.command") return null;
  return record;
}

async function sendClaudeTask(endpoint: string, to: { agent: string; human: string; node: string }, payload: Record<string, unknown>) {
  const envelope = ai2aiClient.createEnvelope({
    to,
    type: "request",
    intent: "dev.claude_task",
    payload,
  });
  await ai2aiClient.sendMessage(endpoint, envelope, { queue: true });
  return envelope;
}

async function ingestFile(ctx: any, filePath: string) {
  const raw = await fs.readFile(filePath, "utf8");
  const data = JSON.parse(raw) as {
    conversation?: string;
    issueId?: string;
    companyId?: string;
    ok?: boolean;
    payload?: Record<string, unknown>;
    error?: string;
  };

  let issueId = data.issueId || "";
  let companyId = data.companyId || "";

  if ((!issueId || !companyId) && data.conversation) {
    const mapping = await lookupConversationMapping(ctx, data.conversation);
    if (mapping) {
      issueId = mapping.issueId;
      companyId = mapping.companyId;
    }
  }

  if (!issueId || !companyId) {
    throw new Error(`Could not resolve issue/company for inbox file ${path.basename(filePath)}`);
  }

  const response = data.payload ?? {};
  const ok = typeof data.ok === "boolean" ? data.ok : Boolean((response as any)?.ok);
  const commandEnvelope = extractAi2AiCommandEnvelope(response);

  const next: BridgeRecord = {
    ...(await getBridgeState(ctx, issueId)),
    issueId,
    status: ok ? "completed" : "failed",
    updatedAt: now(),
    response,
    error: ok ? undefined : String(data.error || (response as any)?.stderr || "Remote task failed"),
  };

  await setBridgeState(ctx, next);
  const summary = JSON.stringify(response, null, 2);
  await ctx.issues.createComment(
    issueId,
    ok
      ? `AI2AI response received. Remote task completed successfully.${commandEnvelope ? " Machine-readable AI2AI command envelope detected in response." : ""}\n\n\`\`\`json\n${summary}\n\`\`\``
      : `AI2AI response received. Remote task failed.${commandEnvelope ? " Machine-readable AI2AI command envelope detected in response." : ""}\n\n\`\`\`json\n${summary}\n\`\`\``,
    companyId,
  );

  if (ok) {
    await ctx.issues.update(issueId, { status: "done" }, companyId);
  }

  await fs.rename(filePath, `${filePath}.processed`);

  return { ok: true, issueId, status: next.status };
}

const plugin = definePlugin({
  async setup(ctx) {
    ctx.data.register(DATA_KEYS.health, async () => {
      return { status: "ok", checkedAt: now(), pluginId: PLUGIN_ID };
    });

    ctx.data.register(DATA_KEYS.issueBridgeState, async (params) => {
      const issueId = typeof params?.issueId === "string" ? params.issueId : "";
      if (!issueId) throw new Error("issueId is required");
      return await getBridgeState(ctx, issueId);
    });

    ctx.actions.register(ACTION_KEYS.dispatchClaudeTask, async (params) => {
      const issueId = typeof params?.issueId === "string" ? params.issueId : "";
      const companyId = typeof params?.companyId === "string" ? params.companyId : "";
      if (!issueId || !companyId) {
        throw new Error("issueId and companyId are required");
      }

      const config = await getConfig(ctx);
      const endpoint = typeof params?.endpoint === "string" ? params.endpoint : config.ai2aiEndpoint || "";
      const agent = typeof params?.agent === "string" ? params.agent : config.recipientAgent || "";
      const human = typeof params?.human === "string" ? params.human : config.recipientHuman || agent || "unknown";
      const node = typeof params?.node === "string" ? params.node : config.recipientNode || "unknown";
      const cwd = typeof params?.cwd === "string" ? params.cwd : undefined;

      if (!endpoint || !agent) {
        throw new Error("AI2AI endpoint and recipient agent are required");
      }

      const issue = await ctx.issues.get(issueId, companyId);
      if (!issue) {
        throw new Error(`Issue not found: ${issueId}`);
      }

      const task = typeof params?.task === "string" && params.task.trim().length > 0
        ? params.task.trim()
        : [issue.title, issue.description].filter(Boolean).join("\n\n");

      const payload: Record<string, unknown> = {
        task,
        commandEnvelope: buildAi2AiCommandEnvelope(task, {
          cwd,
          issueId,
          companyId,
          source: "paperclip-ai2ai-plugin",
        }),
      };
      if (cwd) payload.cwd = cwd;

      const envelope = await sendClaudeTask(endpoint, { agent, human, node }, payload);
      const conversationId = typeof envelope.conversation === "string" ? envelope.conversation : undefined;
      if (conversationId) {
        await storeConversationMapping(ctx, conversationId, issueId, companyId);
      }

      await setBridgeState(ctx, {
        issueId,
        status: "dispatched",
        updatedAt: now(),
        request: {
          endpoint,
          to: { agent, human, node },
          task,
          cwd,
          conversationId,
        },
      });

      await ctx.issues.createComment(
        issueId,
        `AI2AI dispatch sent to **${agent}** via \`${endpoint}\`${conversationId ? ` (conversation \`${conversationId}\`)` : ""}. Included machine-readable AI2AI command envelope for \`dev.claude_task\`.`,
        companyId,
      );

      return {
        ok: true,
        issueId,
        conversationId,
        endpoint,
        to: { agent, human, node },
      };
    });

    ctx.actions.register(ACTION_KEYS.ingestResponse, async (params) => {
      const issueId = typeof params?.issueId === "string" ? params.issueId : "";
      const companyId = typeof params?.companyId === "string" ? params.companyId : "";
      const response = params?.response && typeof params.response === "object" ? params.response : {};
      const ok = typeof params?.ok === "boolean" ? params.ok : Boolean((response as any)?.ok);

      if (!issueId || !companyId) {
        throw new Error("issueId and companyId are required");
      }

      const next: BridgeRecord = {
        ...(await getBridgeState(ctx, issueId)),
        issueId,
        status: ok ? "completed" : "failed",
        updatedAt: now(),
        response: response as Record<string, unknown>,
        error: ok ? undefined : String((response as any)?.stderr || params?.error || "Remote task failed"),
      };

      const commandEnvelope = extractAi2AiCommandEnvelope(response as Record<string, unknown>);

      await setBridgeState(ctx, next);
      const summary = JSON.stringify(response, null, 2);
      await ctx.issues.createComment(
        issueId,
        ok
          ? `AI2AI response received. Remote task completed successfully.${commandEnvelope ? " Machine-readable AI2AI command envelope detected in response." : ""}\n\n\`\`\`json\n${summary}\n\`\`\``
          : `AI2AI response received. Remote task failed.${commandEnvelope ? " Machine-readable AI2AI command envelope detected in response." : ""}\n\n\`\`\`json\n${summary}\n\`\`\``,
        companyId,
      );

      if (ok) {
        await ctx.issues.update(issueId, { status: "done" }, companyId);
      }

      return { ok: true, issueId, status: next.status };
    });

    ctx.actions.register(ACTION_KEYS.syncPendingResponses, async () => {
      const config = await getConfig(ctx);
      const inboxDir = getInboxDir(config);
      await fs.mkdir(inboxDir, { recursive: true });
      const entries = await fs.readdir(inboxDir);
      const pending = entries.filter((entry) => entry.endsWith(".json"));
      const processed: Array<Record<string, unknown>> = [];

      for (const entry of pending) {
        const filePath = path.join(inboxDir, entry);
        processed.push(await ingestFile(ctx, filePath));
      }

      return { ok: true, inboxDir, processedCount: processed.length, processed };
    });
  },

  async onHealth() {
    return { status: "ok", message: "Paperclip AI2AI plugin worker is running" };
  }
});

export default plugin;
runWorker(plugin, import.meta.url);
