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

// Meeting Component Shared Types
export interface MeetingParticipant extends User {
  isMuted?: boolean;
  isVideoOff?: boolean;
  isSpeaking?: boolean;
  stream?: MediaStream;
}

export interface MeetingControls {
  isMuted: boolean;
  isVideoOff: boolean;
}

export interface MeetingCallbacks {
  onToggleMute: MeetingCallback;
  onToggleVideo: MeetingCallback;
  onToggleChat: MeetingCallback;
  onToggleParticipants: MeetingCallback;
  onLeaveMeeting: MeetingCallback;
}

export interface MeetingHeaderInfo {
  roomId: string;
  participantCount: number;
  passcode: string;
  isHost: boolean;
}

export interface VideoStream {
  stream: MediaStream;
  userName?: string;
  userId?: string;
}

export interface ChatState {
  messages: Message[];
  newMessage: string;
  onMessageChange: MessageCallback;
  onSendMessage: MeetingCallback;
}

export interface ParticipantManagement {
  participants: MeetingParticipant[];
  currentUserId: string;
  currentUserName: string;
  isHost: boolean;
  onMuteParticipant?: UserIdCallback;
  hostMutedUsers?: Set<string>;
}

// Standardized Callback Types
export type MeetingCallback = () => void;
export type MessageCallback = (message: string) => void;
export type UserIdCallback = (userId: string) => void;
export type BooleanCallback = (value: boolean) => void;

// Event Handler Types
export type KeyboardEventHandler = (event: React.KeyboardEvent) => void;
export type MouseEventHandler = (event: React.MouseEvent) => void;
export type ChangeEventHandler = (event: React.ChangeEvent<HTMLInputElement>) => void;

// Error State Types
export interface ErrorState {
  hasError: boolean;
  error: Error | null;
  errorMessage: string;
  errorCode?: string;
  canRetry: boolean;
}

export interface LoadingState {
  isLoading: boolean;
  loadingMessage?: string;
  loadingProgress?: number;
}

export interface AsyncState extends ErrorState, LoadingState {}

// Meeting-Specific Error Types
export type MeetingErrorType = 
  | 'CONNECTION_FAILED'
  | 'MEDIA_ACCESS_DENIED'
  | 'PEER_CONNECTION_FAILED'
  | 'ROOM_NOT_FOUND'
  | 'INVALID_PASSCODE'
  | 'NETWORK_ERROR'
  | 'SERVER_ERROR'
  | 'UNKNOWN_ERROR';

export interface MeetingError extends ErrorState {
  errorType: MeetingErrorType;
  context?: string;
  retryAction?: () => void;
}

export interface MeetingState extends AsyncState {
  meetingId: string;
  isConnected: boolean;
  connectionState: 'connecting' | 'connected' | 'disconnected' | 'failed';
}

// Component-Specific Error States
export interface VideoError extends MeetingError {
  streamType: 'local' | 'remote';
  participantId?: string;
}

export interface AudioError extends MeetingError {
  deviceType: 'microphone' | 'speaker';
}

export interface ChatError extends MeetingError {
  messageId?: string;
  failedAction: 'send' | 'receive' | 'delete';
}

// Error Recovery Options
export interface ErrorRecovery {
  canRetry: boolean;
  canReset: boolean;
  canContinue: boolean;
  retryAction?: () => void;
  resetAction?: () => void;
  continueAction?: () => void;
}