# paperclip-ai2ai-plugin

Paperclip plugin for AI2AI task dispatch and result return.

## Goal

Bridge Paperclip task orchestration with AI2AI remote execution.

Initial focus:
- export a Paperclip task as `dev.claude_task`
- receive AI2AI result responses
- update the Paperclip task/ticket state

## Planned Scope

### Phase 1
- outbound Paperclip -> AI2AI task dispatch
- inbound AI2AI -> Paperclip result update
- narrow runtime support for `dev.claude_task`

### Phase 2
- general runtime mapping
- `dev.codex_task`
- `dev.openclaw_task`
- richer state transitions and receipts

### Phase 3
- multi-company and multi-agent routing
- approval policy integration
- production deployment patterns

## Architecture

- **Paperclip** handles task creation, tracking, and governance.
- **AI2AI** handles inter-agent communication, trust, and approvals.
- **Remote executors** perform the actual work.

## Status

Initial plugin build is complete and verified.

Current end-to-end path:
- Paperclip issue -> plugin dispatch action
- plugin sends live `dev.claude_task` over AI2AI
- desktop receiver runs Claude task and returns result over AI2AI
- plugin can ingest returned result files from a response inbox and update the issue

## Narrow End-to-End Wiring

### Outbound dispatch
The plugin worker uses the local AI2AI client in `../skills/ai2ai/ai2ai-client.js` to send a real `dev.claude_task` envelope.

### Return path
Returned AI2AI results can now be written automatically into:

- `/home/darre/.openclaw/workspace/ai2ai-protocol/paperclip-inbox`

Use the helper watcher:

```bash
node /home/darre/.openclaw/workspace/ai2ai-protocol/paperclip-inbox-writer.js --once
# or keep it running
node /home/darre/.openclaw/workspace/ai2ai-protocol/paperclip-inbox-writer.js
```

It scans AI2AI conversation logs for `dev.claude_task` response messages and materializes inbox JSON files for the plugin. Then the plugin action `sync-pending-responses` ingests them, updates issue state, comments the result, and marks the issue done on success.

### Expected inbox file shape
```json
{
  "conversation": "<ai2ai-conversation-id>",
  "ok": true,
  "payload": {
    "ok": true,
    "stdout": "...",
    "stderr": "",
    "finishedAt": "2026-04-10T16:00:00.000Z"
  }
}
```

If `issueId` and `companyId` are present directly, the plugin will use them. Otherwise it resolves them from the stored AI2AI conversation mapping created at dispatch time.

## Next Step

The next real upgrade is to automate the final leg so AI2AI return messages are written into the plugin inbox without manual glue.
