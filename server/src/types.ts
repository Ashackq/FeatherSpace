export type JoinRoomMessage = {
  type: "join_room";
  roomId: string;
  userId: string;
  x: number;
  y: number;
  direction: number;
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

export type IncomingMessage =
  | JoinRoomMessage
  | PositionUpdateMessage
  | SignalMessage
  | ObjectEventMessage;

export type ObjectStateRecord = {
  objectId: string;
  state: Record<string, unknown>;
  updatedAt: number;
  updatedBy: string;
};

export type UserState = {
  userId: string;
  roomId: string;
  x: number;
  y: number;
  direction: number;
  lastSeen: number;
};
