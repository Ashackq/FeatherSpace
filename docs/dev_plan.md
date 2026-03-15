# FeatherSpace Development Plan (Updated to Current Architecture and Status)

Last updated: 2026-03-15

This plan reflects the current implementation in the repository and defines the next execution phases.

---

## 1. Current Architecture Snapshot

### Client

- React + Vite application with route-based product shell.
- Phaser scene embedded in room surfaces.
- Runtime config controlled by env vars:
  - `VITE_WS_URL`
  - `VITE_ENABLE_REALTIME`
  - `VITE_APP_ENV`

### Server

- Node.js + `ws` WebSocket server.
- Room membership tracking.
- Position update relay.
- Signaling relay (`signal` payload pass-through).
- Health endpoint.

### Shared Contracts and Config

- Message contracts in `shared/messageTypes/events.md` and `client/src/types.ts`.
- Environment schema in `shared/schemas/environment.schema.json`.
- Baseline room config in `configs/environments/default_room.json`.

### Architectural Rule (unchanged)

- Client-dominant model remains the core decision:
  - Client handles rendering, movement, proximity decisions, and peer lifecycle decisions.
  - Server remains computation-light (state sync + signaling relay).

---

## 2. Implementation Status

## Completed

- Product shell and page structure (Overview, Rooms, Room Experience, Builder, Ops, Settings).
- Presentation mode with guided flow and responsive UI pass.
- Local movement simulation in room scene:
  - Keyboard movement (WASD + Arrow keys).
  - Simulated nearby peers.
  - Proximity ring and nearby count.
- Realtime status hook with local-mode fallback behavior.
- Room cards, stage cards, and controls responsive/layout fixes for demo stability.

## Partially Completed

- Environment builder has live form + generated config preview, but does not yet persist/publish to backend.
- Server supports core room/state relay but no auth, persistence, or moderation controls.
- Client scene currently uses static room visuals; JSON environment is not yet fully driving Phaser object placement.

## Not Started (core roadmap items)

- End-to-end multi-user movement integration in client via WebSocket.
- Client-side proximity engine integrated with live room state.
- WebRTC media session lifecycle implementation.
- Interactive objects with synced state (whiteboard/notebook/table behavior).

---

## 3. Execution Plan From Current State

## Phase A — Realtime Movement Integration (Next)

Goal: Replace local-only simulation path with optional live room sync when realtime is enabled.

### Tasks

1. Implement client room socket manager:
   - `join_room` on room load.
   - `position_update` emission at throttled rate (10-20 updates/sec).
   - consume `room_state`, `user_joined`, `position_update`, `user_left`.
2. Render remote avatars in Phaser scene from live socket state.
3. Keep local-mode simulation as fallback when realtime disabled/unavailable.

### Deliverables

- Two runtime modes from same room surface:
  - Local mode (already demo-ready).
  - Live sync mode with multiple real users.

---

## Phase B — JSON-Driven Room Runtime

Goal: Make scene structure data-driven from environment configs.

### Tasks

1. Load environment JSON for room route.
2. Validate against existing schema before use.
3. Convert JSON into runtime scene objects and communication parameters:
   - map dimensions
   - object placement
   - talk radius
   - max peers
4. Expose validation errors in Builder and Ops pages.

### Deliverables

- Room Experience scene generated from JSON config, not hardcoded geometry.

---

## Phase C — Proximity Engine (Client-Side)

Goal: Introduce deterministic peer selection loop aligned with architecture contract.

### Tasks

1. Implement periodic proximity check (200ms):
   - compute squared distance
   - filter by talk radius
   - sort nearest
   - cap by max peers
2. Compute diff (`newPeers`, `lostPeers`) against current peer set.
3. Publish proximity state to UI (Ops panel + room overlays).

### Deliverables

- Stable peer candidate selection pipeline ready for RTC attach/detach.

---

## Phase D — WebRTC Audio First

Goal: Enable voice communication before adding video complexity.

### Tasks

1. Implement signaling message handling over existing `signal` relay.
2. Build peer connection manager:
   - offer/answer
   - ICE candidates
   - reconnect/cleanup
3. Add audio device controls:
   - mic mute/unmute
   - push-to-talk
4. Integrate STUN first; add TURN config support.

### Deliverables

- Proximity-based auto-connect audio between nearby peers.

---

## Phase E — Social and Interactive Objects

Goal: Add interaction layer scoped for capstone demo quality.

### Tasks

1. Table zones as private voice scopes.
2. Whiteboard object with shared state events.
3. Notebook/shared notes object events.
4. Door/room transition metadata and flow.

### Deliverables

- Interactive room objects with clear behavior contracts.

---

## Phase F — Hardening, Testing, and Deployment

Goal: Validate target room scale and deployment reliability.

### Tasks

1. Performance pass:
   - update throttling validation
   - peer cap enforcement
   - optional spatial partition optimization
2. Test matrix:
   - multi-user join/leave churn
   - reconnect behavior
   - NAT traversal scenarios
3. Deployment:
   - Vercel for client
   - persistent Node host for server
   - env-specific runtime config

### Deliverables

- Release-candidate prototype suitable for assessment and live demo.

---

## 4. Milestone Checklist

| Milestone | Status | Exit Criteria |
| --- | --- | --- |
| Product Shell + Demo UX | Done | Stable responsive UI and guided presentation flow |
| Local Movement Demo | Done | Keyboard-controlled avatar + simulated peers in local mode |
| Live Movement Sync | Next | Two real clients can move and see each other in same room |
| JSON-Driven Scene | Planned | Room geometry/objects driven by validated JSON |
| Proximity Engine | Planned | Deterministic nearest-peer selection every 200ms |
| WebRTC Audio | Planned | Nearby users auto-connect with stable voice |
| Interactive Objects | Planned | Whiteboard/table/notebook behaviors live |
| Scale + Deploy | Planned | 20-40 room target validated with deployment runbook |

---

## 5. Immediate Sprint (Suggested: 7-10 days)

1. Build client socket room service and live remote avatar rendering.
2. Wire environment JSON into room scene config (dimensions + objects + talk radius).
3. Add proximity engine loop with debug panel in Ops.

If this sprint is completed, the next demo can show both local-mode simulation and true multi-user movement with data-driven room behavior.

