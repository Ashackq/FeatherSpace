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
};

export type RoomStateMessage = {
  type: "room_state";
  users: Array<{
    userId: string;
    roomId: string;
    x: number;
    y: number;
    direction: number;
    lastSeen: number;
  }>;
};

export type IncomingMessage =
  | RoomStateMessage
  | PositionUpdateMessage
  | { type: "user_joined"; userId: string }
  | { type: "user_left"; userId: string }
  | { type: "signal"; fromUser: string; payload: Record<string, unknown> };
