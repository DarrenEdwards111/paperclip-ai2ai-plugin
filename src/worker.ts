import { definePlugin, runWorker } from "@paperclipai/plugin-sdk";
import { ACTION_KEYS, DATA_KEYS, PLUGIN_ID } from "./constants.js";

type BridgeRecord = {
  issueId: string;
  status: "idle" | "dispatched" | "completed" | "failed";
  updatedAt: string;
  request?: {
    endpoint: string;
    to: { agent: string; human: string; node: string };
    task: string;
  };
  response?: Record<string, unknown>;
  error?: string;
};

function now() {
  return new Date().toISOString();
}

function scope(issueId: string) {
  return { scopeKind: "issue" as const, scopeId: issueId, stateKey: "bridge" };
}

async function getBridgeState(ctx: any, issueId: string): Promise<BridgeRecord> {
  return (await ctx.state.get(scope(issueId))) ?? {
    issueId,
    status: "idle",
    updatedAt: now(),
  };
}

async function setBridgeState(ctx: any, record: BridgeRecord) {
  await ctx.state.set(scope(record.issueId), record);
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
      const endpoint = typeof params?.endpoint === "string" ? params.endpoint : "";
      const agent = typeof params?.agent === "string" ? params.agent : "";
      const human = typeof params?.human === "string" ? params.human : agent || "unknown";
      const node = typeof params?.node === "string" ? params.node : "unknown";
      const cwd = typeof params?.cwd === "string" ? params.cwd : undefined;

      if (!issueId || !companyId || !endpoint || !agent) {
        throw new Error("issueId, companyId, endpoint, and agent are required");
      }

      const issue = await ctx.issues.get(issueId, companyId);
      if (!issue) {
        throw new Error(`Issue not found: ${issueId}`);
      }
      const task = typeof params?.task === "string" && params.task.trim().length > 0
        ? params.task.trim()
        : [issue.title, issue.description].filter(Boolean).join("\n\n");

      const payload: Record<string, unknown> = { task };
      if (cwd) payload.cwd = cwd;

      await setBridgeState(ctx, {
        issueId,
        status: "dispatched",
        updatedAt: now(),
        request: {
          endpoint,
          to: { agent, human, node },
          task,
        },
      });

      await ctx.issues.createComment(
        issueId,
        `AI2AI dispatch queued to **${agent}** via \`${endpoint}\`.`,
        companyId,
      );

      return {
        ok: true,
        issueId,
        dispatch: {
          endpoint,
          to: { agent, human, node },
          intent: "dev.claude_task",
          payload,
          note: "Outbound send is prepared here. Wire this action to your AI2AI sender runtime for live delivery.",
        },
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

      await setBridgeState(ctx, next);
      const summary = JSON.stringify(response, null, 2);
      await ctx.issues.createComment(
        issueId,
        ok
          ? `AI2AI response received. Remote task completed successfully.\n\n\`\`\`json\n${summary}\n\`\`\``
          : `AI2AI response received. Remote task failed.\n\n\`\`\`json\n${summary}\n\`\`\``,
        companyId,
      );

      if (ok) {
        await ctx.issues.update(issueId, { status: "done" }, companyId);
      }

      return { ok: true, issueId, status: next.status };
    });

    ctx.events.on("issue.updated", async (event) => {
      ctx.logger.info("Observed issue.updated", { issueId: event.entityId });
    });
  },

  async onHealth() {
    return { status: "ok", message: "Paperclip AI2AI plugin worker is running" };
  }
});

export default plugin;
runWorker(plugin, import.meta.url);
