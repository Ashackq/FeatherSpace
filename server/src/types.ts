export type JoinRoomMessage = {
  type: "join_room";
  roomId: string;
  userId: string;
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

export type IncomingMessage = JoinRoomMessage | PositionUpdateMessage | SignalMessage;

export type UserState = {
  userId: string;
  roomId: string;
  x: number;
  y: number;
  direction: number;
  lastSeen: number;
};
