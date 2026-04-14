# paperclip-ai2ai-plugin

Paperclip plugin for AI2AI task dispatch, live task visibility, and result return.

## Goal

Bridge Paperclip task orchestration with AI2AI remote execution, and expose enough runtime state that a Paperclip UI can show what a remote Claude task is doing before final completion.

## What this now supports

- export a Paperclip task as `dev.claude_task`
- receive AI2AI result responses
- update Paperclip issue and ticket state
- show live bridge status in the issue/task UI
- ingest per-issue runtime status files for active work
- show recent log tail for a running remote task

## Current model

This is now a **full bridge for task visibility**, but still with a simple file-based runtime telemetry path.

There are three layers:

1. **Paperclip plugin**
   - dispatches `dev.claude_task`
   - tracks bridge state per issue
   - shows live task status and recent logs
   - ingests final responses

2. **AI2AI transport**
   - carries the task request to the remote executor
   - carries the final result back

3. **Runtime status writer**
   - materializes in-progress task state as JSON files
   - lets the plugin show what the remote task is doing before completion

## Architecture

### Dispatch path

Paperclip issue -> plugin dispatch action -> AI2AI `dev.claude_task` -> remote executor

Outbound payload includes a machine-readable command envelope:

```json
{
  "task": "Fix the failing build and report what changed",
  "cwd": "/tmp/pall-lean",
  "commandEnvelope": {
    "kind": "ai2ai.command",
    "version": "1",
    "command": "dev.claude_task",
    "instructions": "Fix the failing build and report what changed",
    "cwd": "/tmp/pall-lean",
    "issueId": "...",
    "companyId": "...",
    "source": "paperclip-ai2ai-plugin"
  }
}
```

### Live runtime path

Remote executor or local bridge writes per-issue runtime status JSON files, for example:

```json
{
  "taskId": "claude-task-123",
  "status": "running",
  "cwd": "/tmp/pall-lean",
  "command": "claude --print ...",
  "startedAt": "2026-04-14T02:00:00.000Z",
  "logPath": "/tmp/claude-task-123.log",
  "source": "desktop-claude-bridge"
}
```

The helper `paperclip-live-writer.js` converts these runtime status files into the plugin's live status directory, including a log tail for UI display.

### Result return path

Returned AI2AI results are written into:

- `/home/darre/.openclaw/workspace/ai2ai-protocol/paperclip-inbox`

Then the plugin action `sync-pending-responses` ingests them, updates issue state, comments the result, and marks the issue done on success.

## Directories

### Plugin config paths

Default config values:

- `responseInboxDir`: `/home/darre/.openclaw/workspace/ai2ai-protocol/paperclip-inbox`
- `liveStatusDir`: `/home/darre/.openclaw/workspace/ai2ai-protocol/paperclip-live`

### Runtime status source

Recommended source directory for in-progress task status files:

- `/home/darre/.openclaw/workspace/ai2ai-protocol/paperclip-runtime-status`

## Helper watchers

### Final response watcher

```bash
node /home/darre/.openclaw/workspace/ai2ai-protocol/paperclip-inbox-writer.js --once
node /home/darre/.openclaw/workspace/ai2ai-protocol/paperclip-inbox-writer.js
```

### Live status watcher

```bash
node /home/darre/.openclaw/workspace/ai2ai-protocol/paperclip-live-writer.js --once
node /home/darre/.openclaw/workspace/ai2ai-protocol/paperclip-live-writer.js
```

Optional custom paths:

```bash
node /home/darre/.openclaw/workspace/ai2ai-protocol/paperclip-live-writer.js \
  --src /path/to/runtime-status \
  --out /home/darre/.openclaw/workspace/ai2ai-protocol/paperclip-live
```

## UI surfaces

The plugin now exposes:

- dashboard widget
- issue detail tab
- task detail view

The issue/task panel shows:

- bridge status
- request target and endpoint
- live runtime state (`queued`, `running`, `completed`, `failed`)
- current cwd
- command name
- task id if present
- log path if present
- recent log output
- latest final response payload

## Current limitations

This is not a full terminal stream. It is a pragmatic status bridge.

What it does well:
- show that work is queued/running/completed/failed
- show recent output
- keep issue state and result ingestion unified

What it does not yet do:
- interactive terminal control
- full streaming websocket output
- direct approval buttons for remote prompts
- runtime-specific adapters beyond the current file-based bridge shape

## Near-term next step

The clean next upgrade is to make the remote Claude bridge write runtime status automatically during execution, instead of relying on a separate materialization step.
