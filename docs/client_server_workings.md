# FeatherSpace Client and Server Workings

This document tabulates how the frontend and backend work together in the current codebase.

## Responsibility Split

| Area | Client | Server |
| --- | --- | --- |
| App shell | Renders the main layout, navigation, and presentation mode toggle in [client/src/components/AppShell.tsx](../client/src/components/AppShell.tsx). | Does not render UI. |
| Routing | Owns all browser routes in [client/src/App.tsx](../client/src/App.tsx). | No HTTP page routing in this repo. |
| Landing and directory pages | Shows the overview, room directory, settings, operations, invite entry, and 404 pages in [client/src/pages](../client/src/pages). | No equivalent UI. |
| Room runtime | Renders the Phaser scene, participant rail, chat panels, media controls, and room actions in [client/src/pages/RoomExperiencePage.tsx](../client/src/pages/RoomExperiencePage.tsx). | Holds room presence, chat, object state, environment state, and direct-message state in memory. |
| Environment authoring | Edits room definitions, validates JSON, previews layouts, and publishes environment drafts in [client/src/pages/BuilderPage.tsx](../client/src/pages/BuilderPage.tsx). | Accepts published environment configs over websocket and broadcasts the latest room config to connected clients. |
| Realtime transport | Opens the websocket, joins a room, sends presence, chat, signaling, and object updates from [client/src/hooks/useRoomSync.ts](../client/src/hooks/useRoomSync.ts). | Terminates websocket connections, parses messages, and relays room-scoped events in [server/src/index.ts](../server/src/index.ts). |
| Positioning and peer selection | Computes local proximity and selects nearby peers in [client/src/hooks/useProximityEngine.ts](../client/src/hooks/useProximityEngine.ts). | Broadcasts server-relayed position updates to everyone in the same room. |
| Audio mesh | Builds peer-to-peer audio plus mesh position transport in [client/src/hooks/useRtcAudio.ts](../client/src/hooks/useRtcAudio.ts). | Relays WebRTC signaling messages between peers; it does not process media. |
| Scene rendering | Uses Phaser to render the map, interactable objects, player movement, and interaction prompts in [client/src/phaserScene.ts](../client/src/phaserScene.ts). | Supplies the room state, environment snapshots, and object state that the scene consumes. |
| Config loading | Resolves runtime env vars and environment JSONs in [client/src/config/runtime.ts](../client/src/config/runtime.ts) and [client/src/config/environmentConfig.ts](../client/src/config/environmentConfig.ts). | Reads port and heartbeat settings from process env and keeps all runtime state in memory. |
| Health and status | Shows runtime status in the Ops page and room UI. | Exposes `/health` for service checks. |

## Client Workings

| Layer | What it does | Key files |
| --- | --- | --- |
| Boot | Starts React and mounts the app root. | [client/src/main.tsx](../client/src/main.tsx) |
| Routing | Defines the browser route map for overview, rooms, room runtime, builder, ops, settings, and not-found. | [client/src/App.tsx](../client/src/App.tsx) |
| Shell | Keeps the persistent sidebar, top bar, and presentation-mode behavior. | [client/src/components/AppShell.tsx](../client/src/components/AppShell.tsx) |
| Overview | Summarizes the product and renders a non-interactive scene preview. | [client/src/pages/HomePage.tsx](../client/src/pages/HomePage.tsx) |
| Room directory | Lists templates, launch settings, and demo entry flow. | [client/src/pages/RoomsPage.tsx](../client/src/pages/RoomsPage.tsx) |
| Room runtime | Joins realtime sync, renders the interactive room, handles chat, DMs, room transitions, and object interactions. | [client/src/pages/RoomExperiencePage.tsx](../client/src/pages/RoomExperiencePage.tsx) |
| Builder | Edits room maps and object definitions, validates the result, and publishes room configs. | [client/src/pages/BuilderPage.tsx](../client/src/pages/BuilderPage.tsx) |
| Ops | Shows connectivity, schema, object-state, and runtime health. | [client/src/pages/OpsPage.tsx](../client/src/pages/OpsPage.tsx) |
| Settings | Keeps workspace settings in local component state. | [client/src/pages/SettingsPage.tsx](../client/src/pages/SettingsPage.tsx) |
| Invite join | Verifies an invite token against an API URL and redirects into the target room. | [client/src/pages/InviteJoinPage.tsx](../client/src/pages/InviteJoinPage.tsx) |
| Scene rendering | Uses Phaser to draw the room map, avatars, object overlays, grid, and interaction prompts. | [client/src/phaserScene.ts](../client/src/phaserScene.ts) |
| Room sync | Maintains websocket connection state, identity, presence, chat history, direct messages, and environment snapshots. | [client/src/hooks/useRoomSync.ts](../client/src/hooks/useRoomSync.ts) |
| Proximity | Chooses which remote peers should be treated as near enough for RTC. | [client/src/hooks/useProximityEngine.ts](../client/src/hooks/useProximityEngine.ts) |
| RTC audio | Negotiates peer connections, microphone access, push-to-talk, and mesh position data channels. | [client/src/hooks/useRtcAudio.ts](../client/src/hooks/useRtcAudio.ts) |
| Object sync | Tracks room object states and emits object actions. | [client/src/hooks/useObjectSync.ts](../client/src/hooks/useObjectSync.ts) |
| Runtime config | Reads Vite environment variables and derives websocket/API URLs plus ICE servers. | [client/src/config/runtime.ts](../client/src/config/runtime.ts) |
| Environment config | Loads JSON room templates, validates them, injects map-scoped visuals, and resolves the active room. | [client/src/config/environmentConfig.ts](../client/src/config/environmentConfig.ts) |

## Server Workings

| Layer | What it does | Key files |
| --- | --- | --- |
| HTTP bootstrap | Creates the Express app and HTTP server wrapper. | [server/src/index.ts](../server/src/index.ts) |
| Health check | Responds to `/health` with a simple ok payload. | [server/src/index.ts](../server/src/index.ts) |
| WebSocket server | Accepts websocket connections and tracks socket liveness with ping/pong. | [server/src/index.ts](../server/src/index.ts) |
| Room presence | Keeps a `roomId -> userId -> UserState` map in memory. | [server/src/index.ts](../server/src/index.ts) |
| Object state | Stores per-room object state records and snapshots them to joining clients. | [server/src/index.ts](../server/src/index.ts) |
| Room chat | Stores room chat history in memory, caps history size, and rebroadcasts messages. | [server/src/index.ts](../server/src/index.ts) |
| Direct messages | Stores per-room direct messages and sends them to sender and recipient. | [server/src/index.ts](../server/src/index.ts) |
| Environment state | Stores the current room environment config and rebroadcasts updates. | [server/src/index.ts](../server/src/index.ts) |
| Signaling relay | Forwards WebRTC offers, answers, and ICE candidates between peers. | [server/src/index.ts](../server/src/index.ts) |
| Disconnect handling | Uses a grace timer so refresh/reconnect does not immediately evict the user. | [server/src/index.ts](../server/src/index.ts) |
| Cleanup | Deletes room-scoped state when the last user leaves. | [server/src/index.ts](../server/src/index.ts) |

## Message Flow

| Event | Client sends | Server does | Client receives |
| --- | --- | --- | --- |
| Join room | `join_room` from [useRoomSync](../client/src/hooks/useRoomSync.ts) | Adds user to the room, stores presence, and sends snapshots. | `room_state`, `object_state_snapshot`, `environment_state`, `room_chat_state`, `direct_message_state` |
| Move player | `position_update` from [RoomExperiencePage](../client/src/pages/RoomExperiencePage.tsx) via [useRoomSync](../client/src/hooks/useRoomSync.ts) | Updates the user state and broadcasts it to the room. | `position_update` |
| Room chat | `room_chat_message` | Validates room, stores message, and broadcasts it. | `room_chat_message` and the initial `room_chat_state` snapshot |
| Direct message | `direct_message` | Validates room membership, stores it, and sends it to both participants. | `direct_message` and the initial `direct_message_state` snapshot |
| Object action | `object_event` | Updates object state in memory and broadcasts the new state. | `object_state_update` and `object_state_snapshot` on join |
| Environment publish | `environment_update` from the builder | Stores the room config and rebroadcasts it. | `environment_state` |
| RTC signaling | `signal` | Relays the payload to the target peer. | `signal` |

## Shared Data Model

| Source | Role |
| --- | --- |
| [shared/schemas/environment.schema.json](../shared/schemas/environment.schema.json) | Validates room/environment JSON structure on the client. |
| [shared/messageTypes/events.md](../shared/messageTypes/events.md) | Documents the websocket event names. |
| [configs/environments](../configs/environments) | Contains the room templates the client loads and the builder edits. |

## Practical Summary

The client is where the app feels like a product: routing, layout, room UX, scene rendering, environment editing, RTC audio, and all user interaction live there. The server is intentionally smaller: it keeps transient room state, validates basic room scope, relays messages, and snapshots state to new participants.