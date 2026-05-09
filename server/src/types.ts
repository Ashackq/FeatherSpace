// types.ts: Shared TypeScript types for the FeatherSpace server.
//
// Defines all WebSocket message shapes that the server receives from clients,
// as well as server-side state records for users, objects, and chat.

// --- Incoming WebSocket message types ---

export type JoinRoomMessage = {
  type: "join_room";
  roomId: string;
  userId: string;
  x: number;
  y: number;
  direction: number;
  displayName?: string;
};

export type PositionUpdateMessage = {
  type: "position_update";
  userId: string;
  x: number;
  y: number;
  direction: number;
  timestamp: number;
};

export type SignalMessage = {
  type: "signal";
  targetUser: string;
  payload: Record<string, unknown>;
};

export type ObjectEventMessage = {
  type: "object_event";
  roomId: string;
  objectId: string;
  action: string;
  payload?: Record<string, unknown>;
  timestamp: number;
};

export type EnvironmentUpdateMessage = {
  type: "environment_update";
  roomId: string;
  config: Record<string, unknown>;
  timestamp: number;
};

export type RoomChatPostMessage = {
  type: "room_chat_message";
  roomId: string;
  body: string;
  surface: "whiteboard" | "notebook";
  objectId?: string;
  displayName?: string;
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

export type DirectMessagePostMessage = {
  type: "direct_message";
  roomId: string;
  toUserId: string;
  body: string;
  displayName?: string;
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

export type IncomingMessage =
  | JoinRoomMessage
  | PositionUpdateMessage
  | SignalMessage
  | ObjectEventMessage
  | EnvironmentUpdateMessage
  | RoomChatPostMessage
  | DirectMessagePostMessage;

export type ObjectStateRecord = {
  objectId: string;
  state: Record<string, unknown>;
  updatedAt: number;
  updatedBy: string;
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
