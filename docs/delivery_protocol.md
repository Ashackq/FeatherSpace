# AGENT DELIVERY PROTOCOL

This protocol keeps all contributors aligned while coding in parallel.

## 1. Source of Truth Priority

When documents disagree, use this priority order:

1. `docs/coordination_index.md`
2. `docs/platform_details.md`
3. `docs/agent_prompt_playbook.md`

If conflict remains, stop and open a coordination decision note.

## 2. Branch or Task Ownership

Assign one owner per module at a time:

- `client/rendering/*` -> Frontend Rendering Agent
- `client/proximity/*` -> Proximity and Networking Agent
- `client/rtc/*` -> RTC Signaling Agent
- `server/websocket/*` -> Backend Synchronization Agent
- `shared/schemas/*` and `configs/environments/*` -> Environment JSON Agent

No cross-module edits without an explicit handoff.

## 3. Mandatory Task Template

Each teammate or agent starts with this template:

```text
Task:
Module:
Depends on contracts:
Files expected to change:
Out of scope:
Validation plan:
```

## 4. Required Checks Before Merge

Every completed task must include:

1. Contract check
- Message types and fields unchanged, or documented if changed.

2. Scope check
- Changes only in owned module paths.

3. Runtime check
- No server-side proximity computation introduced.
- No media processing moved to server.

4. Validation check
- JSON schema updates include parser compatibility notes.

5. Test check
- Unit or manual test steps listed.

## 5. Message Contract Guardrails

Do not change these message names casually:

- `join_room`
- `room_state`
- `position_update`
- `signal`

If a change is required:

1. Bump shared schema version.
2. Document migration in handoff notes.
3. Update all impacted modules in one coordinated batch.

## 6. Performance Guardrails

Keep these defaults unless team approves new values:

- Proximity interval: `200ms`
- Max peers: `4`
- WebSocket update rate target: `10-20/sec`
- Room scale target: `20-40` users

## 7. Definition of Done

A task is done only if all are true:

1. Implementation follows module ownership.
2. Contract compatibility is preserved or migrated.
3. Handoff notes are written.
4. Validation/testing evidence is provided.
5. No server load regression against architecture rule.

## 8. Daily Coordination Cadence

Use this lightweight sequence:

1. Start of day
- Pick module owner and publish task template.

2. Mid-day sync
- Report blockers and contract risks.

3. End of day
- Post handoff notes and next actions.
