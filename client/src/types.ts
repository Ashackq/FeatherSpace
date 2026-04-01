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
  users: UserState[];
};

export type UserState = {
  userId: string;
  roomId: string;
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
  | { type: "signal"; fromUser: string; payload: Record<string, unknown> };

export type EnvironmentObject = {
  id: string;
  type: string;
  x: number;
  y: number;
  radius?: number;
};

export type EnvironmentConfig = {
  version: string;
  map: {
    width: number;
    height: number;
  };
  communication: {
    talkRadius: number;
    maxPeers: number;
  };
  objects: EnvironmentObject[];
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
};
