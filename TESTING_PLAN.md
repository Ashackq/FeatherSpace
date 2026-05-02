# FeatherSpace Testing Plan

## Project Overview
FeatherSpace is a **reduced SSR spatial communication platform** that enables real-time collaborative experiences in virtual rooms. It features:
- React + Phaser client for spatial scene rendering
- Node.js + WebSocket server for real-time state sync and signaling relay
- Spatial proximity-based audio/peer selection
- Room-based chat (whiteboard/notebook surfaces)
- Direct messaging between users
- Room environments with configurable objects
- Builder tool for creating/modifying rooms

---

## Testing Strategy

### Testing Levels
1. **Unit Tests**: Individual functions, hooks, and utilities
2. **Integration Tests**: Component interactions, hook integration, WebSocket messaging
3. **End-to-End Tests**: Full user workflows across client and server
4. **Performance Tests**: Real-time sync latency, proximity calculations, audio mesh stability

---

## Module Testing Plan

### 1. CLIENT-SIDE MODULES

#### 1.1 Core Hooks

##### **useRealtimeStatus Hook**
- **Location**: `client/src/hooks/useRealtimeStatus.ts`
- **Purpose**: Manages WebSocket connection lifecycle to realtime backend
- **Test Cases**:
  - ✅ Connection state transitions: `disabled` → `connecting` → `connected`
  - ✅ Reconnection logic with exponential backoff (max 8s)
  - ✅ Error handling and recovery
  - ✅ Multiple reconnection attempts tracking
  - ✅ Proper cleanup on component unmount
  - ✅ Behavior when disabled (`enabled=false`)
  - ✅ Invalid WebSocket URL handling
  - ✅ Network interruption recovery (socket close without unmount)

**Test Type**: Unit Tests
**Dependencies**: Mock WebSocket

---

##### **useRoomSync Hook**
- **Location**: `client/src/hooks/useRoomSync.ts`
- **Purpose**: Manages complete room synchronization (presence, chat, objects, environment)
- **Key Responsibilities**:
  - Join/leave room logic
  - User presence broadcasting
  - Position updates (80ms throttle)
  - Remote user state management
  - Chat message handling (whiteboard/notebook surfaces)
  - Direct message handling
  - Object state synchronization
  - Environment config updates
  - Signal relay for peer-to-peer setup (WebRTC)

**Test Cases**:
  - ✅ Room join flow: sends identity + position
  - ✅ Room leave flow: cleanup on disconnect
  - ✅ Position update throttling (80ms minimum interval)
  - ✅ Remote user state updates from room_state message
  - ✅ User left detection (user_left message)
  - ✅ Room chat message sending and receiving
  - ✅ Direct message sending and receiving
  - ✅ Object state snapshot reception
  - ✅ Object state incremental updates
  - ✅ Environment config reception and updates
  - ✅ Signal forwarding for WebRTC offer/answer/ICE
  - ✅ Reconnection with stored presence bootstrap
  - ✅ Display name normalization
  - ✅ User ID persistence (session storage)
  - ✅ Message deduplication
  - ✅ State cleanup on disabled/disconnected

**Test Type**: Unit Tests + Integration Tests
**Dependencies**: Mock WebSocket, mock message types

---

##### **useProximityEngine Hook**
- **Location**: `client/src/hooks/useProximityEngine.ts`
- **Purpose**: Spatial grid-based peer selection for audio/communication
- **Configuration**:
  - Grid: 20×12 cells across 1800×960px space
  - Drop miss threshold: 3 consecutive misses to remove peer
  - Default interval: 200ms

**Test Cases**:
  - ✅ Grid cell calculation for given x,y coordinates
  - ✅ Same-cell detection (proximity)
  - ✅ Peer ranking by proximity
  - ✅ Max peers limit enforcement
  - ✅ New peer detection (newPeerIds array)
  - ✅ Lost peer detection (lostPeerIds array after threshold)
  - ✅ Peer retention with drop miss counting
  - ✅ Snapshot timestamp accuracy
  - ✅ Behavior when disabled
  - ✅ Behavior with null local position
  - ✅ Interval-based tick execution
  - ✅ Edge cases: user at boundary, talkRadius variations

**Test Type**: Unit Tests
**Dependencies**: Mock position data, mock user states

---

##### **useRtcAudio Hook**
- **Location**: `client/src/hooks/useRtcAudio.ts`
- **Purpose**: WebRTC peer connection mesh for proximity-based audio
- **Key Features**:
  - Initiates peer connections for selected peers
  - Handles offer/answer/ICE signaling
  - Tracks connection states (idle, connecting, connected, failed, closed)
  - Mesh position sharing

**Test Cases**:
  - ✅ Peer connection creation for new peers
  - ✅ Offer generation and sending
  - ✅ Answer handling from signaling
  - ✅ ICE candidate exchange
  - ✅ Connection state tracking
  - ✅ Failed connection detection
  - ✅ Peer connection cleanup on removal
  - ✅ Mesh position broadcasting
  - ✅ Signal event parsing and processing
  - ✅ Multiple concurrent peer connections
  - ✅ Behavior when disabled
  - ✅ Graceful handling of malformed signals

**Test Type**: Integration Tests
**Dependencies**: Mock RTCPeerConnection, mock signaling

---

##### **useObjectSync Hook**
- **Location**: `client/src/hooks/useObjectSync.ts`
- **Purpose**: Wrapper for object state access and action emission
- **Test Cases**:
  - ✅ Object state retrieval by ID
  - ✅ Object count calculation
  - ✅ Action emission (object events)
  - ✅ Disabled state prevents emission
  - ✅ Last update tracking
  - ✅ Null return for missing object

**Test Type**: Unit Tests
**Dependencies**: Mock object states

---

#### 1.2 Pages

##### **HomePage**
- **Location**: `client/src/pages/HomePage.tsx`
- **Test Cases**:
  - ✅ Page renders without errors
  - ✅ Welcome/introduction content displays
  - ✅ Navigation links to other pages work
  - ✅ Responsive layout on mobile/desktop
  - ✅ Loading states if fetching data

**Test Type**: Component Tests

---

##### **RoomsPage**
- **Location**: `client/src/pages/RoomsPage.tsx`
- **Test Cases**:
  - ✅ List of available rooms displays
  - ✅ Room navigation/join functionality
  - ✅ Room search/filter (if available)
  - ✅ Loading state while fetching rooms
  - ✅ Empty state handling
  - ✅ Error state handling

**Test Type**: Component Tests + Integration Tests

---

##### **RoomExperiencePage**
- **Location**: `client/src/pages/RoomExperiencePage.tsx`
- **Purpose**: Main collaborative experience with Phaser scene, chat, and audio
- **Key Features**:
  - Phaser scene rendering for room environment
  - User avatar movement and positioning
  - Whiteboard/notebook chat surfaces
  - Direct messaging panel
  - Invite token generation
  - Proximity-based audio mesh
  - Remote user tracking

**Test Cases**:
  - ✅ Room initialization and scene loading
  - ✅ User avatar rendering at initial position
  - ✅ Player movement (WASD/arrow keys)
  - ✅ Position updates sent on movement
  - ✅ Remote user avatars appear and move
  - ✅ Remote user disappearance handling
  - ✅ Room chat message sending (whiteboard surface)
  - ✅ Room chat message sending (notebook surface)
  - ✅ Chat message history display
  - ✅ Direct message sending to specific users
  - ✅ Direct message history with user
  - ✅ Invite token generation via API
  - ✅ Invite URL sharing
  - ✅ Invite expiration display
  - ✅ Proximity engine integration
  - ✅ RTC audio peer selection
  - ✅ Realtime status indicator
  - ✅ Local mode fallback (when realtime disabled)
  - ✅ Environment config loading

**Test Type**: Integration Tests + E2E Tests
**Dependencies**: Mock WebSocket, mock Phaser scene

---

##### **BuilderPage**
- **Location**: `client/src/pages/BuilderPage.tsx`
- **Purpose**: Create and edit room environments and objects
- **Key Features**:
  - Load/save environment configurations
  - Room CRUD operations
  - Object CRUD operations
  - Live preview of changes
  - Sync with room via WebSocket

**Test Cases**:
  - ✅ Environment configuration loading
  - ✅ Add new room
  - ✅ Edit existing room
  - ✅ Delete room
  - ✅ Add object to room
  - ✅ Edit object properties
  - ✅ Delete object
  - ✅ Preview changes in real-time
  - ✅ Publish configuration to room (environment_update)
  - ✅ Handle conflicts with remote updates
  - ✅ Schema validation on configuration save
  - ✅ Undo/redo functionality (if applicable)
  - ✅ Draft configuration management
  - ✅ Session environment synchronization

**Test Type**: Integration Tests
**Dependencies**: Mock WebSocket, mock schema validation

---

##### **OpsPage**
- **Location**: `client/src/pages/OpsPage.tsx`
- **Purpose**: Operations/monitoring dashboard
- **Test Cases**:
  - ✅ Realtime status display
  - ✅ Room sync status
  - ✅ Signaling relay status
  - ✅ Object state counts
  - ✅ Schema validation status
  - ✅ Generated report timestamp accuracy

**Test Type**: Component Tests

---

##### **InviteJoinPage**
- **Location**: `client/src/pages/InviteJoinPage.tsx`
- **Purpose**: Accept invite token and join host's room
- **Test Cases**:
  - ✅ Parse invite token from URL
  - ✅ Validate token with backend API
  - ✅ Join room after validation
  - ✅ Handle expired token
  - ✅ Handle invalid token
  - ✅ Auto-join or show confirmation
  - ✅ Redirect to room experience after join

**Test Type**: Integration Tests
**Dependencies**: Mock API responses

---

##### **SettingsPage**
- **Location**: `client/src/pages/SettingsPage.tsx`
- **Test Cases**:
  - ✅ Display name configuration
  - ✅ Audio settings (if applicable)
  - ✅ Privacy/notification settings
  - ✅ Save and persist settings
  - ✅ Reset to defaults

**Test Type**: Component Tests

---

##### **NotFoundPage**
- **Location**: `client/src/pages/NotFoundPage.tsx`
- **Test Cases**:
  - ✅ Display on invalid route
  - ✅ Navigation back to home

**Test Type**: Component Tests

---

#### 1.3 Components

##### **AppShell**
- **Location**: `client/src/components/AppShell.tsx`
- **Test Cases**:
  - ✅ Navigation layout renders
  - ✅ Routing between pages works
  - ✅ Header/footer display
  - ✅ Mobile navigation (if applicable)

**Test Type**: Component Tests

---

##### **ScenePreview**
- **Location**: `client/src/components/ScenePreview.tsx`
- **Test Cases**:
  - ✅ Phaser scene initialization
  - ✅ Objects render correctly
  - ✅ Scene preview responsive sizing
  - ✅ Configuration application to scene

**Test Type**: Component Tests + Visual Tests

---

#### 1.4 Configuration & Utilities

##### **runtime.ts & environmentConfig.ts**
- **Location**: `client/src/config/`
- **Test Cases**:
  - ✅ Environment variable loading (VITE_WS_URL, etc.)
  - ✅ Default values when variables missing
  - ✅ Environment resolution for different deployments
  - ✅ Room environment loading
  - ✅ Configuration schema validation

**Test Type**: Unit Tests

---

#### 1.5 Data & Types

##### **types.ts**
- **Location**: `client/src/types.ts`
- **Test Cases**:
  - ✅ Type definitions are compatible with server messages
  - ✅ Message union type discriminators work
  - ✅ Serialization/deserialization consistency

**Test Type**: Type Tests (TypeScript validation)

---

---

## 2. SERVER-SIDE MODULES

### **WebSocket Server** (`server/src/index.ts`)

#### Core Functionality

##### **Room Management**
- **Data Structures**:
  - `rooms`: Map<roomId, Map<userId, UserState>>
  - `roomObjectStates`: Map<roomId, Map<objectId, ObjectStateRecord>>
  - `roomChatMessages`: Map<roomId, RoomChatMessage[]>
  - `roomDirectMessages`: Map<roomId, Map<conversationKey, DirectMessage[]>>

**Test Cases**:
  - ✅ Create room on first user join
  - ✅ Broadcast room_state to all users in room
  - ✅ Clean up empty rooms
  - ✅ Handle concurrent joins
  - ✅ Persist room state during session
  - ✅ Limit chat message history size
  - ✅ Object state persistence within room session

**Test Type**: Integration Tests

---

##### **User Presence & Join/Leave**
- **Handlers**:
  - `join_room` message: User enters room with position
  - `user_left` message: User leaves room
  - Position updates with user state
  - Graceful disconnect handling (5s grace period configurable)

**Test Cases**:
  - ✅ User join: create user state, broadcast room_state
  - ✅ User leave: remove from room, broadcast room_state
  - ✅ Duplicate user handling (same userId, different socket)
  - ✅ Display name extraction/normalization
  - ✅ Position bootstrap from join message
  - ✅ Immediate room state broadcast on join
  - ✅ Disconnect timeout and reconnection window
  - ✅ Grace period for graceful reconnects (5s default)
  - ✅ Hard disconnect after grace period expiry

**Test Type**: Integration Tests

---

##### **Position Updates**
- **Handler**: `position_update` message
- **Features**:
  - Per-room broadcast
  - Optional logging (LOG_POSITION_UPDATES env)
  - Timestamp tracking

**Test Cases**:
  - ✅ Position update broadcast to room
  - ✅ Remote user state update with new x,y,direction
  - ✅ Timestamp attached to message
  - ✅ Filtering out self-updates (userId comparison)
  - ✅ High-frequency updates handling (performance)
  - ✅ Out-of-order position handling (keep latest by timestamp)
  - ✅ Optional logging capture

**Test Type**: Integration Tests

---

##### **Chat Messaging**
- **Handlers**:
  - `room_chat_message`: Post message to whiteboard/notebook
  - `room_chat_state`: Query current messages (on join)

**Test Cases**:
  - ✅ Chat message creation (messageId generation)
  - ✅ Store message with room reference
  - ✅ Broadcast to room on new message
  - ✅ Send room_chat_state on user join
  - ✅ Message history retention per room
  - ✅ Surface type preservation (whiteboard vs notebook)
  - ✅ Author tracking (userId, displayName)
  - ✅ Object reference for whiteboard objects (optional)
  - ✅ Timestamp accuracy
  - ✅ Handle missing fields gracefully

**Test Type**: Integration Tests

---

##### **Direct Messaging**
- **Handlers**:
  - `direct_message`: Send private message between users

**Test Cases**:
  - ✅ Message routing to target user only
  - ✅ Conversation key generation (sorted userIds)
  - ✅ Store direct message history
  - ✅ Send message to connected user
  - ✅ Handle target user offline (queue or drop policy)
  - ✅ MessageId uniqueness
  - ✅ Author/recipient tracking
  - ✅ Per-room direct message isolation

**Test Type**: Integration Tests

---

##### **Object State Synchronization**
- **Handlers**:
  - `object_state_snapshot`: Initial sync of all objects
  - `object_state_update`: Incremental update
  - `object_event`: Action emission on object

**Test Cases**:
  - ✅ Snapshot broadcast on join
  - ✅ Incremental updates broadcast to room
  - ✅ State merge on updates
  - ✅ Update timestamp tracking
  - ✅ Updater user tracking (updatedBy)
  - ✅ Event broadcasting to room
  - ✅ Payload pass-through in events
  - ✅ Object state cleanup (if room closes)

**Test Type**: Integration Tests

---

##### **Environment Configuration**
- **Handlers**:
  - `environment_update`: Update room environment config
  - `environment_state`: Query current config (on join)

**Test Cases**:
  - ✅ Configuration storage per room
  - ✅ Broadcast to room on update
  - ✅ Metadata tracking (updatedAt, updatedBy)
  - ✅ Schema validation (if applicable)
  - ✅ Send current config on user join
  - ✅ Conflict resolution on concurrent updates
  - ✅ Full config replacement vs. partial updates

**Test Type**: Integration Tests

---

##### **WebRTC Signaling Relay**
- **Handler**: `signal` message
- **Features**:
  - Relay offer/answer/ICE candidates
  - Target user delivery

**Test Cases**:
  - ✅ Signal message routing to target user
  - ✅ Payload preservation (offer/answer/candidate)
  - ✅ Sender identification (fromUser)
  - ✅ Handle target offline
  - ✅ SDP content pass-through
  - ✅ ICE candidate forwarding
  - ✅ Error handling for malformed signals

**Test Type**: Integration Tests

---

### **API Endpoints**

##### **GET /health**
- **Test Cases**:
  - ✅ Returns `{ ok: true, service: "featherspace-server" }`
  - ✅ No authentication required
  - ✅ Fast response time

**Test Type**: Unit Tests

---

##### **POST /invites**
- **Body**: `{ roomId, hostUserId }`
- **Response**: `{ ok: true, token, roomId, hostUserId, inviteUrl, expiresAt }`

**Test Cases**:
  - ✅ Generate unique invite token
  - ✅ Set expiration (INVITE_TTL_MS, default 12h)
  - ✅ Persist invite token with metadata
  - ✅ Return valid invite URL
  - ✅ Trim/sanitize roomId and hostUserId
  - ✅ Reject invalid input
  - ✅ Error on missing fields

**Test Type**: Unit Tests + Integration Tests

---

##### **GET /invites/:token**
- **Response**: `{ ok: true, token, roomId, hostUserId, expiresAt }`

**Test Cases**:
  - ✅ Retrieve valid token
  - ✅ Return 404 for expired token
  - ✅ Return 404 for invalid token
  - ✅ Automatically clean expired tokens (sanitize)
  - ✅ Case sensitivity/normalization

**Test Type**: Unit Tests + Integration Tests

---

### **Helper Functions**

##### **Message Parsing & Broadcasting**
- `safeParse()`: Graceful JSON parsing with error logging
- `broadcastToRoom()`: Send message to all users in room
- `broadcastRoomState()`: Full room state snapshot

**Test Cases**:
  - ✅ Safe parsing catches and logs malformed JSON
  - ✅ Broadcast only to open sockets (readyState check)
  - ✅ Room state includes all current users
  - ✅ Error handling on socket send failure

**Test Type**: Unit Tests

---

##### **Utilities**
- `normalizeDisplayName()`: Trim and default
- `createMessageId()`: Unique message identifier
- `createInviteToken()`: Unique token generation
- `sanitizeInviteStore()`: Clean expired invites
- `getConversationKey()`: Sorted user pair for DM grouping

**Test Cases**:
  - ✅ Display name trimming and defaults
  - ✅ MessageId uniqueness across many generations
  - ✅ Token uniqueness
  - ✅ Sanitize removes only expired entries
  - ✅ Conversation key consistency (A-B same as B-A)

**Test Type**: Unit Tests

---

---

## 3. SHARED MODULES

### **Message Types** (`shared/messageTypes/events.md`)
- **Test Cases**:
  - ✅ All message type definitions are documented
  - ✅ Type discriminators are unique
  - ✅ Message structure consistency between client and server

**Test Type**: Documentation validation

---

### **JSON Schemas** (`shared/schemas/`)
- `ws-join-room.schema.json`
- `ws-position-update.schema.json`
- `ws-signal.schema.json`
- `environment.schema.json`

**Test Cases**:
  - ✅ Valid messages pass schema validation
  - ✅ Invalid messages fail validation
  - ✅ Required fields enforced
  - ✅ Type constraints enforced
  - ✅ Client and server use same schemas

**Test Type**: Schema Validation Tests

---

---

## 4. END-TO-END WORKFLOWS

### **Workflow 1: Join Room & Chat**
1. User A navigates to `/rooms/:roomId`
2. `RoomExperiencePage` loads
3. `useRoomSync` connects to WebSocket
4. Send `join_room` message with position
5. Receive `room_state` with existing users
6. User B joins same room
7. Both users see each other's avatars
8. User A sends chat message (room_chat_message)
9. User B receives and displays message

**Test Type**: E2E Test

**Setup**:
- Start server
- Launch 2 client instances
- Join same room

**Assertions**:
- ✅ Both users appear in each other's view
- ✅ Chat message delivery < 100ms
- ✅ No message loss
- ✅ Correct author/timestamp

---

### **Workflow 2: Proximity-Based Audio Mesh**
1. 3+ users in same room
2. Users A & B within proximity radius
3. Users A & C outside radius
4. `useProximityEngine` selects A-B as peers
5. `useRtcAudio` initiates peer connection (A→B offer)
6. Server relays signals via `signal` messages
7. P2P connection established
8. Audio streams between A-B only

**Test Type**: E2E Test

**Setup**:
- Position 3 users at different coordinates
- Monitor proximity snapshots

**Assertions**:
- ✅ Correct peer selection based on grid
- ✅ Offers/answers relayed correctly
- ✅ Connection state transitions
- ✅ Peers added/removed as positions change
- ✅ Max peers limit enforced

---

### **Workflow 3: Invite & Join**
1. User A generates invite: `POST /invites`
2. Receives token and URL
3. Shares URL to User B
4. User B opens `/join/:inviteToken`
5. `InviteJoinPage` validates token: `GET /invites/:token`
6. Joins User A's room automatically
7. Appears in User A's presence list

**Test Type**: E2E Test

**Setup**:
- User A in room
- Generate invite
- Open incognito/new browser for User B

**Assertions**:
- ✅ Valid token returns room info
- ✅ Expired token returns 404
- ✅ User B joins correct room
- ✅ User A sees User B

---

### **Workflow 4: Builder & Live Preview**
1. User opens `/builder`
2. Loads environment configuration
3. Edits: add new room with objects
4. Publishes changes: `environment_update`
5. Changes immediately visible in live room
6. Other users in room see environment change
7. Scene re-renders with new configuration

**Test Type**: E2E Test

**Setup**:
- User A on builder page
- User B in same room
- User A has write permissions

**Assertions**:
- ✅ Configuration persists on save
- ✅ Live preview updates immediately
- ✅ Room users notified of changes
- ✅ Schema validation passes/fails appropriately

---

### **Workflow 5: Direct Messaging**
1. User A selects User B from user list
2. Opens DM panel
3. Sends direct_message
4. User B receives message
5. Message appears in conversation history
6. Reply sent back to User A

**Test Type**: E2E Test

**Setup**:
- 2 users in room
- DM UI enabled

**Assertions**:
- ✅ Message delivered
- ✅ Correct recipient
- ✅ Timestamp accurate
- ✅ History preserved per conversation

---

### **Workflow 6: Reconnection & State Recovery**
1. User A in room with position & chat history
2. Network interruption (close WebSocket)
3. `useRoomSync` starts reconnect (exponential backoff)
4. Reconnects successfully
5. Presence bootstrap restores position
6. Chat history resynced
7. User appears to other users without leaving

**Test Type**: Integration Test

**Setup**:
- User in room for 10s
- Disconnect WebSocket
- Observe reconnect behavior

**Assertions**:
- ✅ Reconnect attempted within 1-8s
- ✅ Position restored from session storage
- ✅ Chat history replayed
- ✅ No duplicate messages
- ✅ User doesn't appear as left/rejoined

---

---

## 5. PERFORMANCE TESTING

### **Load Testing**
- **Scenario**: 50+ users in single room
- **Metrics**:
  - Position update latency (target: <100ms)
  - Chat message latency (target: <200ms)
  - Memory usage on server
  - CPU usage on server
  - Client FPS in Phaser scene

**Test Type**: Performance Test

---

### **Latency Benchmarks**
- Position update round-trip: < 100ms
- Chat message broadcast: < 200ms
- Signal relay (WebRTC): < 50ms
- Room state initial broadcast: < 500ms

---

### **Network Resilience**
- High packet loss (5-10%)
- High latency (500ms+)
- Intermittent disconnects
- Graceful degradation

**Test Type**: Network Chaos Tests

---

---

## 6. TESTING TOOLS & SETUP

### **Recommended Testing Stack**

#### Unit Testing
- **Framework**: Vitest or Jest
- **Target**: Hooks, utilities, components in isolation
- **Mock WebSocket**: Mock library for ws module

#### Integration Testing
- **Framework**: Vitest + React Testing Library
- **Target**: Component + hook combinations, server message handling
- **Mock Server**: Mock WebSocket server or test server instance

#### E2E Testing
- **Framework**: Playwright or Cypress
- **Target**: Full workflows with real server
- **Infrastructure**: Docker for consistent server environment

#### Type Testing
- **Framework**: TypeScript `check` or tsd
- **Target**: Type definitions, message compatibility

### **Mock Data**
- Sample room configurations
- Sample user states
- Sample chat/direct messages
- WebSocket message fixtures

---

## 7. TEST ENVIRONMENT SETUP

### **Local Development**
```bash
# Install dependencies
npm install

# Run dev server in one terminal
npm run dev:server

# Run dev client in another terminal
npm run dev:client
```

### **Testing**
```bash
# Unit tests
npm run test:unit

# Integration tests
npm run test:integration

# E2E tests
npm run test:e2e

# All tests
npm run test
```

### **Environment Variables for Testing**
```env
# .env.test
VITE_WS_URL=ws://localhost:8080
VITE_ENABLE_REALTIME=true
VITE_APP_ENV=test
PORT=8080
LOG_POSITION_UPDATES=true
DISCONNECT_GRACE_MS=5000
INVITE_TTL_MS=3600000
```

---

## 8. REGRESSION TEST CHECKLIST

### Before Every Release
- [ ] All unit tests pass
- [ ] All integration tests pass
- [ ] E2E workflows complete successfully
- [ ] Performance benchmarks within acceptable range
- [ ] No console errors or warnings
- [ ] Type checking passes
- [ ] Schema validation passes
- [ ] No breaking changes in message types

### Critical User Paths
- [ ] Join room and see other users
- [ ] Send and receive chat messages
- [ ] Create and share invite link
- [ ] Audio mesh establishes between peers
- [ ] Builder creates and publishes environment
- [ ] Settings persist correctly
- [ ] Navigation between pages works
- [ ] Direct messaging works
- [ ] Reconnection on network loss
- [ ] Display names normalize correctly

---

## 9. PRIORITY & TIMELINE

### Phase 1: Core (Week 1-2)
- useRoomSync connection/join/leave
- useRealtimeStatus reconnection
- Room presence broadcast
- Chat messaging
- Server API endpoints

### Phase 2: Spatial Features (Week 3-4)
- useProximityEngine grid/peer selection
- useRtcAudio peer connections
- Signal relaying
- Invite generation/validation

### Phase 3: Advanced (Week 5-6)
- Environment configuration updates
- Object state synchronization
- Direct messaging flows
- Builder workflows

### Phase 4: Performance & E2E (Week 7-8)
- Load testing (50+ users)
- Network resilience testing
- Full workflow E2E tests
- Performance benchmarking

---

## 10. SUCCESS CRITERIA

✅ **All Core Tests Pass**
- Connection management
- Room synchronization
- Message delivery

✅ **Performance Targets Met**
- <100ms position update latency
- <200ms chat delivery
- Stable 60 FPS in Phaser

✅ **Reliability**
- 99%+ message delivery
- Graceful reconnection
- No memory leaks

✅ **E2E Scenarios Work**
- Multi-user room collaboration
- Audio mesh between peers
- Invite-join workflows
- Builder live updates

---

## 11. MAINTENANCE & UPDATES

### After Each Development Sprint
- Update this testing plan with new features
- Add new test cases for bugs discovered
- Benchmark performance regressions
- Archive test results

### Quarterly Review
- Analyze test coverage metrics
- Identify high-risk areas
- Plan performance optimizations
- Update environment configurations

