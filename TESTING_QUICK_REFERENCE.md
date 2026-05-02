# FeatherSpace Quick Test Reference

## Testing Quick Lookup

### Core Modules to Test

| Module | Type | Key Test Cases |
|--------|------|-----------------|
| `useRealtimeStatus` | Hook | Connection lifecycle, reconnect backoff, error recovery |
| `useRoomSync` | Hook | Join/leave, position sync, chat, objects, environment |
| `useProximityEngine` | Hook | Grid cells, peer selection, max peers, lost peers |
| `useRtcAudio` | Hook | Peer connections, offer/answer/ICE, mesh state |
| `useObjectSync` | Hook | Object retrieval, state tracking, action emission |

### Pages to Test

| Page | Test Focus |
|------|------------|
| RoomExperiencePage | Avatar rendering, movement, chat, audio, invites |
| BuilderPage | Config CRUD, object editing, live preview, publish |
| InviteJoinPage | Token validation, room join, redirect |
| OpsPage | Status display, monitoring |
| HomePage, RoomsPage | Navigation, list rendering |

### Server to Test

| Component | Critical Tests |
|-----------|-----------------|
| Room Join/Leave | User presence, state broadcast, display name |
| Position Updates | Broadcast, frequency, timestamp accuracy |
| Chat | Message creation, storage, delivery per surface |
| Direct Messages | Routing, history per conversation |
| Objects | State sync, incremental updates, events |
| Signaling | Offer/answer/ICE relay to target peers |

### API Endpoints

| Endpoint | Tests |
|----------|-------|
| GET /health | Returns ok: true |
| POST /invites | Generate token, set TTL, return URL |
| GET /invites/:token | Validate token, return metadata, 404 on expired |

---

## Quick Test Scenarios

### ✅ Scenario 1: Basic Chat (5 min)
```
1. Open client at localhost:5173/rooms/research-studio
2. Open second client in different window
3. Verify both see each other (remote user appears)
4. Send chat message in first client
5. Verify message appears in both clients
```

### ✅ Scenario 2: Invite Link (5 min)
```
1. In room experience, click "Create Invite"
2. Copy invite URL
3. Open new incognito window
4. Paste URL and navigate
5. Verify user joins host's room
6. Verify host sees new user appear
```

### ✅ Scenario 3: Audio Mesh (10 min)
```
1. Three users in same room
2. Monitor browser console (proxy mesh updates)
3. Move users to different grid cells
4. Verify peer selections update
5. Check proximity engine logs
```

### ✅ Scenario 4: Builder (10 min)
```
1. Navigate to /builder
2. Add new room object
3. Publish changes
4. Go to room experience (different tab)
5. Verify room reflects new object
```

### ✅ Scenario 5: Reconnection (10 min)
```
1. User in room for 10s
2. Open DevTools Network tab
3. Close WebSocket connection (or go offline)
4. Observe reconnect attempts
5. Bring network back online
6. Verify user stays in room (no duplicate join)
```

---

## Test Data Reference

### Example User State
```json
{
  "userId": "user-abc123",
  "displayName": "Guest-5",
  "roomId": "research-studio",
  "x": 900,
  "y": 480,
  "direction": 0,
  "lastSeen": 1715000000000
}
```

### Example Room Chat Message
```json
{
  "type": "room_chat_message",
  "messageId": "1715000000000-abc123",
  "authorId": "user-abc123",
  "authorName": "Guest-5",
  "roomId": "research-studio",
  "body": "Hello everyone!",
  "surface": "whiteboard",
  "timestamp": 1715000000000
}
```

### Example Position Update
```json
{
  "type": "position_update",
  "userId": "user-abc123",
  "x": 905,
  "y": 485,
  "direction": 45,
  "timestamp": 1715000000050
}
```

### Example Invite Response
```json
{
  "ok": true,
  "token": "abc123def456",
  "roomId": "research-studio",
  "hostUserId": "user-abc123",
  "inviteUrl": "http://localhost:5173/join/abc123def456",
  "expiresAt": 1715086400000
}
```

---

## Environment Variables

### Client (.env)
```env
VITE_WS_URL=ws://localhost:8080
VITE_ENABLE_REALTIME=true
VITE_APP_ENV=development
```

### Server
```env
PORT=8080
LOG_POSITION_UPDATES=true           # Log every position update
DISCONNECT_GRACE_MS=5000            # Grace period for reconnect
INVITE_TTL_MS=43200000              # 12 hours
```

---

## Common Issues & Solutions

| Issue | Solution |
|-------|----------|
| WebSocket won't connect | Check VITE_WS_URL, server running, CORS headers |
| Position updates not broadcast | Check room exists, socket open, roomId valid |
| Chat messages don't appear | Verify message surface type, room_chat_state synced |
| Peer connection fails | Check proximity grid, signal relay working, firewall |
| Invite token 404 | Token expired (>12h), check INVITE_TTL_MS |
| Remote users don't appear | Check join_room message sent, room_state received |
| Audio cut out | Check proximity (peer selection), RTCPeerConnection state |

---

## Test Execution Commands

```bash
# Development setup
npm install
npm run dev:server &
npm run dev:client

# Unit tests (create/run when available)
npm run test:unit

# Integration tests (create/run when available)
npm run test:integration

# E2E tests with Playwright (create/run when available)
npm run test:e2e

# Type checking
npm run build

# Build for production
npm run build:client && npm run build:server
```

---

## Performance Targets

| Metric | Target |
|--------|--------|
| Position update latency | < 100ms |
| Chat message delivery | < 200ms |
| Signal relay (WebRTC) | < 50ms |
| Room state initial broadcast | < 500ms |
| Client FPS in Phaser | ≥ 60 |
| Proximity recalc interval | 200ms |

---

## Coverage Checklist

Before releasing, verify:

- [ ] useRealtimeStatus: connect, reconnect, error handling
- [ ] useRoomSync: join, leave, presence, chat, objects
- [ ] useProximityEngine: grid cells, peer selection
- [ ] useRtcAudio: peer connections, signals
- [ ] RoomExperiencePage: avatar, movement, chat, audio
- [ ] BuilderPage: config editing, live preview
- [ ] Server join/leave: presence tracking, broadcast
- [ ] Server chat: message storage, broadcast
- [ ] Server signals: relay to target peer
- [ ] API: /health, /invites POST/GET
- [ ] E2E: join+chat, invite+join, audio mesh, builder publish

