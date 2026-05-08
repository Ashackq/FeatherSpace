# FeatherSpace Comprehensive Logging & Debugging Guide

## Overview

Comprehensive structured logging has been added across the entire FeatherSpace system for full visibility during testing. All logs use a consistent JSON format with timestamps, module names, and event types.

**Build Status**: ✅ Client & Server compile successfully

---

## Log Format

All logs follow this pattern:

```
[FS] ISO_TIMESTAMP [LEVEL] MODULE > EVENT_NAME {...details in JSON}
```

**Log Levels**: `DEBUG`, `INFO`, `WARN`, `ERROR`

**Example**:
```
[FS] 2026-05-05T10:30:45.123Z [INFO] RTC > peer_created {"peerId":"user-abc123","iceServers":2}
[FS] 2026-05-05T10:30:46.456Z [INFO] WS > room_state_received {"roomId":"research-studio","userCount":3}
[FS] 2026-05-05T10:30:47.789Z [WARN] RTC > stale_connection_detected {"peerId":"user-xyz789","state":"connecting","timeoutMs":15000}
```

---

## Client-Side Logging

### 1. RTC Audio (useRtcAudio.ts)

**Peer Connection Lifecycle**:
- `peer_created`: New RTCPeerConnection created
- `peer_state_change`: Connection state transitioned (new → connecting → connected → failed → closed)
- `peer_connection_closed`: Peer connection was closed
- `peer_state_reused`: Existing peer connection reused for same peer

**Offer/Answer/ICE**:
- `offer_generated`: Offer created with SDP line count
- `offer_sent`: Offer dispatched to target peer
- `answer_received`: Answer received from target peer  
- `ice_candidate`: Individual ICE candidate gathered (type: host/srflx/relay/etc)
- `ice_gathering_state`: ICE gathering state changed (new → gathering → complete)
- `ice_connection_state`: ICE connection state (new → checking → connected → failed)
- `connection_state`: P2P connection state with elapsed time since creation
- `signal_error`: Signal processing failed

**Mesh & Recovery**:
- `mesh_channel_opened`: Data channel ready for position sync
- `mesh_channel_closed`: Data channel closed
- `mesh_position_sent`: Position update sent to peer (x,y,direction)
- `mesh_position_received`: Position update received from peer
- `stale_connection_detected`: Connection stuck in "new" or "connecting" for >15s
- `connection_recovery_attempt`: Attempting to recover connection (reason: stale_connection_timeout, restart_ice, failed, etc)

**Example RTC Logs**:
```json
{"peerId":"user-xyz","state":"connecting","elapsedMs":1500}
{"peerId":"user-xyz","state":"state_change","offerCount":2,"iceCandidates":12}
{"peerId":"user-xyz","sdpLines":45}
{"peerId":"user-xyz","state":"connecting","timeoutMs":15000}
```

### 2. WebSocket/Room Sync (useRoomSync.ts)

**Connection Lifecycle**:
- `connecting`: WebSocket initiating connection
- `connected`: WebSocket established (userId logged)
- `disconnected`: WebSocket closed (reason: socket_closed, error, etc)
- `reconnecting`: Reconnection attempt #N after delay_ms
- `error`: WebSocket error occurred

**Room State**:
- `join_room_sent`: Join message sent to server (roomId, userId, x, y)
- `room_state_received`: Initial room state received (userCount)
- `user_joined`: New user appeared in room
- `user_left`: User left room

**Position Updates**:
- `position_update_sent`: Position update broadcast (x, y, direction)
- `position_update_received`: Position update from peer (userId, x, y)

**Chat & DM**:
- `chat_message_sent`: Chat message posted (surface: whiteboard/notebook, bodyLength)
- `chat_message_received`: Chat message received (authorId, surface, bodyLength)
- `room_chat_state`: Chat history received on join
- `direct_message_sent`: DM sent to user (toUserId, bodyLength)
- `direct_message_received`: DM received from user (fromUserId, bodyLength)
- `direct_message_state`: DM history received on join

**Signaling**:
- `signal_sent`: WebRTC signal dispatched (targetUser, kind: offer/answer/ice)
- `signal_received`: WebRTC signal received (fromUser, kind)

**Example WebSocket Logs**:
```json
{"userId":"user-abc","reconnectAttempt":2,"delayMs":2000}
{"roomId":"research-studio","userCount":5}
{"userId":"user-xyz","x":900,"y":480}
{"surface":"whiteboard","bodyLength":145}
{"targetUser":"user-xyz","kind":"offer"}
```

### 3. Proximity Engine (useProximityEngine.ts)

**Peer Selection**:
- `grid_cell_calculated`: User position mapped to grid (x,y → col,row)
- `peer_selection_changed`: Proximity snapshot updated (selectedCount, newCount, lostCount, maxPeers, list of IDs)
- `peer_added`: Peer entered proximity radius (peerId, totalPeers)
- `peer_lost`: Peer exited proximity radius after threshold (peerId, missCount)
- `snapshot_taken`: Proximity calculation completed (timestamp, nearbyCount, selectedCount)

**Example Proximity Logs**:
```json
{"userId":"user-abc","x":900,"y":480,"col":10,"row":8}
{"selectedCount":3,"newCount":1,"lostCount":0,"maxPeers":4,"selectedIds":"user-x,user-y,user-z","newIds":"user-z","lostIds":""}
{"peerId":"user-xyz","totalPeers":3}
```

### 4. Application Events (debug.ts)

- `page_load`: Page navigation (pageName, optional roomId)
- `user_action`: User initiated action (action name + details)
- `error`: Application error with context
- `system_snapshot`: Full system state dump (userId, roomId, rtcPeerCount, rtcPeerStates, selectedPeerIds)

---

## Server-Side Logging

### WebSocket Connection Management

**Connection Events**:
- `ws.connection_opened`: New socket connected (clients count)
- `ws.connection_closed`: Socket disconnected (clients count)  
- `ws.connection_error`: Socket error occurred
- `ws.heartbeat`: Heartbeat ping/pong cycle (activeSockets, deadSockets, totalClients, roomsActive)

### Room Management

**User Presence**:
- `room.user_joined`: User entered room (roomId, userId, displayName, roomSize)
- `room.user_left`: User left room (roomId, userId, roomSize)
- `room.deleted`: Room closed (empty/no users) (roomId)
- `room.user_state_upserted`: User state first recorded

**Position Updates**:
- `room.position_update`: Position update received & broadcast (roomId, userId, x, y, direction)

**Chat & Messages**:
- `room.chat_message`: Chat message posted (roomId, userId, surface, bodyLength, messageCount)
- `room.direct_message`: Direct message relayed (roomId, fromUserId, toUserId, bodyLength, messageCount)
- `room.chat_message_rejected`: Chat rejected (reason, details)
- `room.direct_message_rejected`: DM rejected (reason, target_not_in_room/room_mismatch, details)

**RTC Signaling**:
- `rtc.signal_relay`: Signal relayed to peer (fromUser, targetUser, kind: offer/answer/ice, delivered, roomId)

**Objects & Environment**:
- `room.object_state_update`: Object state changed (roomId, userId, objectId, action)
- `room.object_event_rejected`: Object event rejected
- `room.environment_updated`: Environment config updated (roomId, userId)
- `room.environment_update_rejected`: Environment update rejected

**Server Startup**:
- `server.started`: Server listening (port, logPositionUpdates, disconnectGraceMs, wsHeartbeatIntervalMs, environment)

**Example Server Logs**:
```json
{"roomId":"research-studio","userId":"user-abc123","displayName":"Guest-5","roomSize":2,"iceServers":"configured"}
{"fromUser":"user-abc","targetUser":"user-xyz","kind":"offer","delivered":true,"roomId":"research-studio"}
{"activeSockets":15,"deadSockets":2,"totalClients":17,"roomsActive":3}
```

---

## Accessing Logs During Testing

### Browser Console (Client Logs)

1. Open DevTools: `F12` (Windows/Linux) or `Cmd+Option+I` (Mac)
2. Go to **Console** tab
3. All logs appear with `[FS]` prefix
4. Filter logs by module: `Ctrl+F` → type `RTC`, `WS`, `PROXIMITY`, etc.

**Best Practices**:
- Keep console open during testing to monitor live events
- Copy logs to file for post-analysis: Right-click → "Save as" (or use `copy(console.log)`)
- Use timestamps to correlate client/server events

### Server Logs (Terminal Output)

All server logs print to stdout as JSON lines:

```bash
cd /Users/akashmc/Work/FeatherSpace
npm run dev:server
# Logs appear as server receives messages
```

**Parsing Server Logs**:
```bash
# Filter for RTC signaling events
npm run dev:server 2>&1 | grep "rtc.signal_relay"

# Filter for room join events  
npm run dev:server 2>&1 | grep "room.user_joined"

# Get heartbeat status
npm run dev:server 2>&1 | grep "ws.heartbeat"
```

---

## Test Scenarios with Logging

### Scenario 1: Basic Join & Presence

**Expected Log Sequence**:
```
[WS] connecting to wss://...
[WS] connected (userId: user-abc123)
[WS] join_room_sent (roomId: research-studio)
[WS] room_state_received (userCount: 1)
[PROXIMITY] grid_cell_calculated (x: 900, y: 480, col: 10, row: 8)
[PROXIMITY] peer_selection_changed (selectedCount: 0, newCount: 0)
```

**What to check**:
- Connection established within 2-3s
- Room state received immediately after join
- No error logs

---

### Scenario 2: Multi-User Proximity & RTC

**Expected Sequence** (3+ users in room):
```
[WS] room_state_received (userCount: 3)
[PROXIMITY] peer_selection_changed (selectedCount: 2, newCount: 2, newIds: "user-xyz,user-uvw")
[RTC] peer_created (peerId: user-xyz, iceServers: 2)
[RTC] offer_generated (peerId: user-xyz, sdpLines: 45)
[RTC] offer_sent (peerId: user-xyz, offersInFlight: 1)
[RTC] ice_candidate (peerId: user-xyz, candidateType: srflx)
[RTC] ice_gathering_state (peerId: user-xyz, state: complete)
[RTC] connection_state (peerId: user-xyz, state: connecting, elapsedMs: 500)
[RTC] connection_state (peerId: user-xyz, state: connected, elapsedMs: 2000)
[RTC] mesh_channel_opened (peerId: user-xyz)
[RTC] mesh_position_sent (peerId: user-xyz, x: 905, y: 485)
[RTC] mesh_position_received (peerId: user-xyz, x: 810, y: 520)
```

**What to check**:
- Peers are selected within 1 tick (~200ms)
- Offers generated for new peers
- ICE candidates collected (multiple per peer)
- Connection state progression is: new → connecting → connected
- Mesh channel opens after connection stable
- Position data flows over mesh (every 66ms)
- No stale_connection_detected warnings

---

### Scenario 3: Chat Message Flow

**Client Logs**:
```
[WS] chat_message_sent (surface: whiteboard, bodyLength: 42)
[WS] signal_sent (targetUser: server, kind: chat)
```

**Server Logs**:
```
{"room.chat_message","roomId":"research-studio","userId":"user-abc","surface":"whiteboard","bodyLength":42,"messageCount":1}
```

**Other Client Logs**:
```
[WS] message_received (type: room_chat_message)
[WS] chat_message_received (authorId: user-abc, surface: whiteboard, bodyLength: 42)
```

---

### Scenario 4: Reconnection After Network Loss

**Client Logs**:
```
[WS] disconnected (reason: socket_closed)
[WS] reconnecting (attempt: 1, delayMs: 1000)
[WS] connecting to wss://...
[WS] connected (userId: user-abc123)
[WS] join_room_sent (roomId: research-studio)
[WS] room_state_received (userCount: 2)
[PROXIMITY] peer_selection_changed (selectedCount: 1, newCount: 1)
[RTC] peer_created (peerId: user-xyz, iceServers: 2)
[RTC] offer_generated ...
```

**Server Logs**:
```
{"room.user_left","roomId":"research-studio","userId":"user-abc","roomSize":1}
[grace period of 5s]
{"room.user_joined","roomId":"research-studio","userId":"user-abc","roomSize":2,"iceServers":"configured"}
```

---

### Scenario 5: Stale Connection Recovery

**Client Logs** (if stuck at "connecting" for >15s):
```
[RTC] connection_state (peerId: user-xyz, state: connecting, elapsedMs: 15000)
[RTC] stale_connection_detected (peerId: user-xyz, state: connecting, timeoutMs: 15000)
[RTC] connection_recovery_attempt (peerId: user-xyz, reason: stale_connection_timeout)
[RTC] peer_connection_closed (peerId: user-xyz, reason: connecting)
[RTC] peer_created (peerId: user-xyz, iceServers: 2)
[RTC] offer_generated (peerId: user-xyz, sdpLines: 45)
```

**What to check**:
- Recovery attempt logs confirm stale detection working
- New peer created after cleanup
- Connection should succeed on retry

---

## Log Analysis Tools

### 1. Manual Console Grep

```bash
# Filter server logs in real-time
npm run dev:server 2>&1 | grep "rtc\|mesh\|heartbeat"

# Extract only errors
npm run dev:server 2>&1 | grep "error\|rejected\|failed"

# Count events by type
npm run dev:server 2>&1 | grep "room.chat_message" | wc -l
```

### 2. Export & Parse Logs

```bash
# Save server logs to file
npm run dev:server > server_logs.txt 2>&1

# Parse JSON logs with jq (if installed)
cat server_logs.txt | grep "^{" | jq '.event'  # List all events
cat server_logs.txt | grep "^{" | jq 'select(.event == "rtc.signal_relay")'  # Filter by event
```

### 3. Browser Console Export

In DevTools Console:
```javascript
// Copy all [FS] logs to clipboard
copy(document.body.innerText)

// Or save to file (open DevTools, paste this)
const logs = Array.from(document.querySelectorAll('[data-level]')).map(el => el.textContent);
console.save(logs, "client_logs.txt");  // Some browsers support this
```

---

## Performance Baselines (from logs)

| Metric | Target | How to Measure |
|--------|--------|---|
| Position update latency | < 100ms | Time from `position_update_sent` to `position_update_received` |
| Chat delivery latency | < 200ms | Time from `chat_message_sent` to `chat_message_received` |
| RTC connection time | < 3s | Time from `peer_created` to `connection_state: connected` |
| ICE gathering time | < 1s | Time from `ice_gathering_state: new` to `ice_gathering_state: complete` |
| Signal relay time | < 50ms | Time from `signal_sent` to `signal_received` on peer |
| Proximity update interval | ~200ms | Time between `peer_selection_changed` events |

**Example Perf Check** (from logs):
```
peer_created: 10:30:45.001Z
connection_state connected: 10:30:47.234Z
→ Connection time: 2.233 seconds ✓ (target <3s)
```

---

## Troubleshooting Common Issues via Logs

### Issue: "Remote user doesn't appear"

**Check logs for**:
1. ` room_state_received` - Did server send user list?
2. `peer_selection_changed` - Was peer selected for proximity?
3. `peer_created` → `connection_state: connected` - Did RTC establish?
4. `mesh_position_received` - Are mesh messages flowing?

**If missing**: 
- Missing `room_state_received` → Server connection issue
- Missing `peer_created` → Proximity issue or RTC disabled
- Missing `connection_state: connected` → ICE/TURN issue → check stale_connection_detected logs

---

### Issue: "Audio cuts out intermittently"

**Check logs for**:
1. `mesh_channel_opened` - Is datachannel stable?
2. `stale_connection_detected` - Connections getting stuck?
3. `connection_recovery_attempt` - Frequent recoveries?
4. `connection_state` changes to `failed` - Ice failures?

**If seeing**: 
- Frequent `stale_connection_detected` → Increase `RTC_STALE_CONNECTION_TIMEOUT_MS`
- Many `connection_recovery_attempt` → NAT/firewall issue → check TURN config
- `failed` state without recovery → TURN not working

---

### Issue: "Server logs show no activity"

**Check**:
1. Server started with `server.started` event?
2. Any `ws.connection_opened` events?
3. Is `LOG_POSITION_UPDATES=true` in env? (otherwise position_update logs suppressed)

**If missing**:
- No `server.started` → Server failed to start
- No `ws.connection_opened` → Client not connecting (check client logs for connect error)

---

## Configuration for Testing

### Enable Verbose Logging

**Client (.env)**:
```env
# Already verbose by default with new Debug utility
# No additional config needed
```

**Server (.env)**:
```env
LOG_POSITION_UPDATES=true        # Log every position update
DISCONNECT_GRACE_MS=5000          # 5s grace period for reconnect
WS_HEARTBEAT_INTERVAL_MS=10000    # 10s heartbeat tick
```

### Adjust RTC Timeouts

**Client (src/hooks/useRtcAudio.ts constants)**:
```typescript
const RTC_REPAIR_INTERVAL_MS = 4000;           // Repair check frequency
const RTC_OFFER_RETRY_COOLDOWN_MS = 12000;    // Min time between offers
const RTC_STALE_CONNECTION_TIMEOUT_MS = 15000; // Timeout for stuck connections
```

Adjust these if:
- Too many stale_connection_detected → Increase timeout
- Peers not connecting → Decrease repair interval or cooldown

---

## Quick Reference Card

**Key Log Searches During Testing**:

```bash
# ALL logs
grep "\[FS\]"

# All errors/warnings
grep -E "error|warn|failed|rejected|stale"

# RTC connection establishment
grep "peer_created\|offer_generated\|connection_state"

# Proximity changes
grep "peer_selection_changed"

# Message delivery
grep "sent\|received" | grep -E "chat|direct|position"

# Reconnection activity
grep "disconnect\|reconnect\|connection_recovery"

# Server room state
grep "room.user_joined\|room.user_left\|room.deleted"

# Server heartbeat health
grep "ws.heartbeat"
```

---

## Summary

✅ **Logging is now comprehensive and ready for system testing**

- **Client**: RTC, WebSocket, Proximity, Application events
- **Server**: Connections, Rooms, Messages, Signaling, Heartbeat
- **Format**: Consistent JSON timestamps for easy correlation
- **Levels**: DEBUG/INFO/WARN/ERROR for filtering
- **Build**: Both client & server compile successfully

**Next Steps**:
1. Start dev server: `npm run dev:server`
2. Start dev client: `npm run dev:client`
3. Open DevTools Console in browser
4. Run test scenarios and watch logs flow
5. Use grep/log filters above to diagnose issues
6. Check performance baselines from timestamps

Good luck with testing! 🚀
