
# AGENT COORDINATION INDEX

Canonical coordination reference for the FeatherSpace capstone.
All contributors (human and AI) must follow this document first.

## 1. Purpose

Keep all modules compatible while allowing parallel work.

Primary architecture decision:

- Client-dominant spatial communication platform
- Server remains computation-light
- WebSocket for state sync and signaling
- WebRTC P2P for audio/video media

## 2. Source of Truth

Read and apply docs in this order:

1. `docs/coordination_index.md`
2. `docs/platform_details.md`
3. `docs/agent_prompt_playbook.md`
4. `docs/delivery_protocol.md`

## 3. Core Module Ownership

| Module | Owner Agent | Scope |
| --- | --- | --- |
| Client Rendering Engine | Frontend Rendering Agent | Avatar movement, map rendering, input and camera behavior |
| Proximity Engine | Proximity and Networking Agent | Distance checks, peer selection, connect/disconnect diff |
| WebSocket Sync Server | Backend Synchronization Agent | Room state, join/leave flow, position broadcast |
| WebRTC Signaling Layer | RTC Signaling Agent | Offer/answer/candidate signaling and lifecycle handling |
| JSON Environment System | Environment JSON Agent | Schema validation, parser model, object behavior binding |

No cross-module edits without explicit handoff.

## 4. Shared Stack

Frontend:

- React
- Phaser.js
- WebRTC API
- Web Audio API

Backend:

- Node.js
- Express
- WebSocket
- MongoDB

Validation:

- AJV JSON Schema Validator

## 5. Message Contract Baseline

Position update:

```json
{
  "type": "position_update",
  "userId": "string",
  "x": 0,
  "y": 0,
  "direction": 0,
  "timestamp": 0
}
```

Join room:

```json
{
  "type": "join_room",
  "roomId": "string",
  "userId": "string"
}
```

Room state response:

```json
{
  "type": "room_state",
  "users": []
}
```

Signaling relay:

```json
{
  "type": "signal",
  "targetUser": "id",
  "payload": {
    "sdp": "...",
    "candidate": "..."
  }
}
```

Rule: signaling payload is relayed by server, not interpreted semantically.

## 6. Proximity Contract

All clients must use this algorithm:

```text
distanceSquared = dx*dx + dy*dy
selected = nearest users within TALK_RADIUS, capped at MAX_PEERS
newPeers = selected - currentConnections
lostPeers = currentConnections - selected
connect(newPeers)
disconnect(lostPeers)
interval = 200 ms
```

## 7. WebRTC Lifecycle Contract

1. Client detects candidate peer from proximity engine.
2. Client initiates signaling through server relay.
3. Clients exchange SDP offer/answer and ICE candidates.
4. Peer connection becomes active.
5. Cleanup executes on peer loss, disconnect, or timeout.

Media transport remains standard WebRTC DTLS-SRTP.

## 8. Environment Data Contract

Environment is data-driven and loaded from JSON.

Required communication keys:

- `communication.talkRadius`
- `communication.maxPeers`

Parser responsibilities:

- Validate schema before runtime use.
- Convert JSON into runtime map/object structures.
- Bind object behavior contracts.

## 9. Scale and Performance Targets

- Room scale target: 20-40 users
- Max peers per user: 4
- Proximity check interval: 200ms
- WebSocket update target: 10-20 updates/sec

## 10. Non-Negotiable Architecture Rule

Server must remain computation-light.

Server is responsible for:

- authentication
- room membership/state
- signaling relay

Client is responsible for:

- rendering
- proximity and peer selection
- WebRTC connection management

## 11. Working Agreement

Before implementation:

1. Confirm scope and non-scope.
2. Confirm touched contracts.
3. Confirm owner module.

After implementation:

1. Publish handoff summary.
2. Report contract changes or explicit `none`.
3. Report risks and next owner action.

Use `docs/agent_prompt_playbook.md` for prompt templates and `docs/delivery_protocol.md` for definition of done.
