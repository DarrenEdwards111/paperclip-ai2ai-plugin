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

Scaffold in progress.
