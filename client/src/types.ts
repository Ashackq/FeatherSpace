export type PositionUpdateMessage = {
  type: "position_update";
  userId: string;
  x: number;
  y: number;
  direction: number;
  timestamp: number;
};

export type JoinRoomMessage = {
  type: "join_room";
  roomId: string;
  userId: string;
  x: number;
  y: number;
  direction: number;
  displayName?: string;
};

export type RoomStateMessage = {
  type: "room_state";
  users: UserState[];
};

export type ObjectStateRecord = {
  objectId: string;
  state: Record<string, unknown>;
  updatedAt: number;
  updatedBy: string;
};

export type ObjectEventMessage = {
  type: "object_event";
  roomId: string;
  objectId: string;
  action: string;
  payload?: Record<string, unknown>;
  timestamp: number;
};

export type ObjectStateSnapshotMessage = {
  type: "object_state_snapshot";
  roomId: string;
  states: ObjectStateRecord[];
};

export type ObjectStateUpdateMessage = {
  type: "object_state_update";
  roomId: string;
  objectId: string;
  action: string;
  state: Record<string, unknown>;
  updatedAt: number;
  updatedBy: string;
};

export type EnvironmentUpdateMessage = {
  type: "environment_update";
  roomId: string;
  config: EnvironmentConfig;
  timestamp: number;
};

export type EnvironmentStateMessage = {
  type: "environment_state";
  roomId: string;
  config: EnvironmentConfig;
  updatedAt: number;
  updatedBy: string;
};

export type RoomChatMessage = {
  type: "room_chat_message";
  roomId: string;
  messageId: string;
  authorId: string;
  authorName: string;
  body: string;
  surface: "whiteboard" | "notebook";
  objectId?: string;
  timestamp: number;
};

export type RoomChatStateMessage = {
  type: "room_chat_state";
  roomId: string;
  messages: RoomChatMessage[];
};

export type DirectMessage = {
  type: "direct_message";
  roomId: string;
  messageId: string;
  fromUserId: string;
  fromUserName: string;
  toUserId: string;
  body: string;
  timestamp: number;
};

export type DirectMessageStateMessage = {
  type: "direct_message_state";
  roomId: string;
  messages: DirectMessage[];
};

export type UserState = {
  userId: string;
  roomId: string;
  displayName?: string;
  x: number;
  y: number;
  direction: number;
  lastSeen: number;
};

export type IncomingMessage =
  | RoomStateMessage
  | PositionUpdateMessage
  | { type: "user_joined"; userId: string }
  | { type: "user_left"; userId: string }
  | { type: "signal"; fromUser: string; payload: Record<string, unknown> }
  | ObjectStateSnapshotMessage
  | ObjectStateUpdateMessage
  | EnvironmentStateMessage
  | RoomChatStateMessage
  | RoomChatMessage
  | DirectMessageStateMessage
  | DirectMessage;

export type EnvironmentObject = {
  id: string;
  type: string;
  x: number;
  y: number;
  visual?: string;
  spriteUrl?: string;
  radius?: number;
  scopeId?: string;
  boardId?: string;
  noteId?: string;
  targetRoomId?: string;
  spawnX?: number;
  spawnY?: number;
  label?: string;
  [key: string]: unknown;
};

export type EnvironmentObjectDefinition = {
  type: string;
  visual?: string;
  parameters: string[];
};

export type EnvironmentRoom = {
  id: string;
  name?: string;
  spawnPoint: { x: number; y: number };
  objects: EnvironmentObject[];
};

export type EnvironmentVisuals = {
  mapImageUrl?: string;
  playerSpriteUrl?: string;
  remotePlayerSpriteUrl?: string;
  artifactSprites?: {
    whiteboard?: string;
    private_room?: string;
    table?: string;
    table_cluster?: string;
    notebook?: string;
    door?: string;
    room_label?: string;
    [key: string]: string | undefined;
  };
};

export type ObjectInteraction = {
  objectId: string;
  objectType: string;
  label: string;
  targetRoomId?: string;
  spawnX?: number;
  spawnY?: number;
};

export type EnvironmentConfig = {
  version: string;
  map: {
    width: number;
    height: number;
  };
  visuals?: EnvironmentVisuals;
  communication: {
    talkRadius: number;
    maxPeers: number;
  };
  objects: EnvironmentObjectDefinition[];
  rooms: EnvironmentRoom[];
};

export type ResolvedEnvironmentConfig = {
  version: string;
  map: { width: number; height: number };
  visuals?: EnvironmentVisuals;
  communication: { talkRadius: number; maxPeers: number };
  objects: EnvironmentObject[];
  activeRoom: EnvironmentRoom;
};

export type EnvironmentValidationIssue = {
  path: string;
  message: string;
};

export type EnvironmentFileStatus = {
  fileName: string;
  isValid: boolean;
  errors: EnvironmentValidationIssue[];
};

export type EnvironmentPipelineStatus = {
  isValid: boolean;
  totalErrors: number;
  files: EnvironmentFileStatus[];
};

export type LoadedEnvironment = {
  roomId: string;
  environmentFile: string;
  isValid: boolean;
  usedFallback: boolean;
  errors: EnvironmentValidationIssue[];
  config: EnvironmentConfig;
  resolvedConfig: ResolvedEnvironmentConfig;
  activeRoomId: string;
};
