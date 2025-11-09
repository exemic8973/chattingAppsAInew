export interface Room {
  id: string;
  passcode: string;
  createdAt: Date;
  users: User[];
}

export interface User {
  id: string;
  name: string;
  isHost: boolean;
  peerId?: string;
}

export interface Message {
  id: string;
  userId: string;
  userName: string;
  content: string;
  timestamp: Date;
  type: 'text' | 'system';
}

export interface CallState {
  isCalling: boolean;
  isInCall: boolean;
  callType: 'voice' | 'video' | null;
  remoteStream?: MediaStream;
  localStream?: MediaStream;
}

export interface RoomInfo {
  id: string;
  passcode: string;
  shareUrl: string;
}