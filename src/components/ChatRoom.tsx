'use client';

import { useState, useEffect, useRef } from 'react';
import { getSocket, initializeSocket } from '@/lib/socket';
import { WebRTCManager } from '@/lib/webrtc';
import { User, Message, CallState } from '@/types';
import { formatTime, copyToClipboard } from '@/lib/utils';
import { useLanguage } from '@/contexts/LanguageContext';

interface ChatRoomProps {
  roomId: string;
  userName: string;
  passcode: string;
  isOwner?: boolean;
}

export default function ChatRoom({ roomId, userName, passcode, isOwner = false }: ChatRoomProps) {
  const { t } = useLanguage();
  const [users, setUsers] = useState<User[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [showOwnerPanel, setShowOwnerPanel] = useState(false); // Default hidden
  const [callState, setCallState] = useState<CallState>({
    isCalling: false,
    isInCall: false,
    callType: null,
  });
  const [incomingCall, setIncomingCall] = useState<{
    fromUser: User;
    callType: 'voice' | 'video';
  } | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const webrtcManager = useRef<WebRTCManager | null>(null);
  const hasJoinedRoom = useRef(false); // Track if we've already joined to prevent duplicates

  useEffect(() => {
    console.log('🚀 Initializing ChatRoom...');
    console.log('📍 Room ID:', roomId);
    console.log('👤 User Name:', userName);
    console.log('🔑 Passcode:', passcode);
    console.log('⭐ Is Owner:', isOwner);

    const socket = getSocket();
    console.log('🔌 Socket initialized with ID:', socket.id);
    console.log('📡 Socket connected:', socket.connected);

    webrtcManager.current = new WebRTCManager();

    // Set up WebRTC signal handler to relay signals via Socket.IO
    webrtcManager.current.onSignal((signalData) => {
      console.log('📡 Emitting WebRTC signal to server:', signalData);
      socket.emit('webrtc-signal', {
        roomId,
        signalData
      });
    });

    // 🔐 CRITICAL FIX: Authenticate socket before joining room
    const authenticateSocket = (): Promise<void> => {
      return new Promise((resolve, reject) => {
        const token = localStorage.getItem('token');

        if (!token) {
          console.log('⚠️ No auth token found, proceeding as guest');
          resolve();
          return;
        }

        console.log('🔑 Authenticating socket with token...');

        let authTimeout: NodeJS.Timeout;
        let isAuthenticated = false;

        const cleanup = () => {
          socket.off('auth-success', handleAuthSuccess);
          socket.off('auth-error', handleAuthError);
          if (authTimeout) clearTimeout(authTimeout);
        };

        const handleAuthSuccess = (data: any) => {
          console.log('✅ Socket authenticated successfully:', data);
          isAuthenticated = true;
          cleanup();
          resolve();
        };

        const handleAuthError = (error: any) => {
          console.error('❌ Socket authentication failed:', error);
          cleanup();
          // Continue anyway as guest
          resolve();
        };

        authTimeout = setTimeout(() => {
          if (!isAuthenticated) {
            console.log('⏰ Auth timeout, continuing as guest...');
            cleanup();
            resolve();
          }
        }, 5000);

        socket.on('auth-success', handleAuthSuccess);
        socket.on('auth-error', handleAuthError);

        if (socket.connected) {
          socket.emit('authenticate', { token });
        } else {
          socket.once('connect', () => {
            console.log('✅ Socket connected, now authenticating...');
            socket.emit('authenticate', { token });
          });
        }
      });
    };

    // 🔥 CRITICAL FIX: Set up room-joined listener BEFORE attempting to join
    socket.on('room-joined', ({ roomId, users, messages }) => {
      console.log('✅ Successfully joined room:', roomId);
      console.log('👥 Participants received:', users);
      console.log('💬 Messages received:', messages);
      
      // Add safety checks for undefined/null values
      const safeUsers = users || [];
      const safeMessages = messages || [];
      
      console.log(`📊 Participant count: ${safeUsers.length}`);
      console.log(`📊 Participant details:`, safeUsers);
      
      // Filter out any duplicate messages from initial load
      const uniqueMessages = safeMessages.filter((msg: Message, index: number, self: Message[]) => 
        index === self.findIndex(m => m.id === msg.id)
      );
      console.log('💬 Unique messages after filtering:', uniqueMessages);
      
      console.log('🔄 Setting users and messages...');
      setUsers(safeUsers);
      setMessages(uniqueMessages);
      
      // Log current state after setting
      console.log('📊 Updated users state after setUsers:', users);
      console.log('📊 Updated messages state after setMessages:', uniqueMessages);
      console.log('✅ Room join process completed');
    });

    // 🔥 CRITICAL FIX: Handle new user joining the room (consolidated handler)
    socket.on('user-joined', (data: { userName?: string; user: { id: string; name: string; isHost: boolean }; participantCount?: number }) => {
      console.log('👤 New user joined:', data.user);
      console.log('📊 Participant count:', data.participantCount);

      if (!data.user || !data.user.id || !data.user.name) {
        console.log('⚠️ Invalid user data received in user-joined event:', data.user);
        return;
      }

      // Check if user already exists to prevent duplicates
      setUsers(prev => {
        const exists = prev.some(user => user.id === data.user.id);
        if (exists) {
          console.log('⚠️ User already exists, skipping:', data.user.name);
          return prev;
        }

        const newUsers = [...prev, {
          id: data.user.id,
          name: data.user.name,
          isHost: data.user.isHost
        }];
        console.log('👥 Updated users list:', newUsers);
        return newUsers;
      });
    });

    socket.on('user-left', (userName: string) => {
      console.log('👤 User left:', userName);
      setUsers(prev => prev.filter(user => user.name !== userName));
    });

    socket.on('new-message', (message: Message) => {
      console.log('💬 New message received:', message);
      console.log('📊 Current messages before adding:', messages);
      
      // Add safety checks for message data
      if (!message || !message.id || !message.content) {
        console.log('⚠️ Invalid message data received:', message);
        return;
      }
      
      console.log('👤 Message sender:', message.userName);
      console.log('📍 Current user:', userName);
      
      setMessages(prev => {
        console.log('📊 Previous messages:', prev);
        // Check if message already exists to prevent duplicates
        const exists = prev.some(msg => msg.id === message.id);
        if (exists) {
          console.log('⚠️ Message already exists, skipping:', message.id);
          return prev;
        }
        const newMessages = [...prev, message];
        console.log('📊 New messages after adding:', newMessages);
        return newMessages;
      });
    });

    // Removed duplicate event listeners that were causing conflicts

    socket.on('incoming-call', ({ fromUser, callType }) => {
      setIncomingCall({ fromUser, callType });
    });

    socket.on('call-accepted', () => {
      setCallState(prev => ({ ...prev, isCalling: false, isInCall: true }));
    });

    socket.on('call-rejected', () => {
      setCallState(prev => ({ ...prev, isCalling: false }));
      alert('Call was rejected');
    });

    socket.on('call-ended', () => {
      // Don't emit back to server - we're receiving the end notification
      endCall(false);
    });

    socket.on('webrtc-signal', async ({ signalData, fromUserId }) => {
      if (webrtcManager.current) {
        webrtcManager.current.signal(signalData);
      }
    });

    // 🔐 Authenticate and join room (only once)
    if (!hasJoinedRoom.current) {
      console.log('🚀 Starting authentication and room join process...');
      hasJoinedRoom.current = true; // Mark as joining to prevent duplicates

      authenticateSocket()
        .then(() => {
          console.log('✅ Socket authentication complete, now joining room...');

          // Send join-room event
          const persistentUserId = localStorage.getItem('socketUserId');
          console.log('🚀 Sending join-room event:', { roomId, userName, passcode, persistentUserId });

          if (socket.connected) {
            socket.emit('join-room', { roomId, passcode, userName, persistentUserId });
          } else {
            console.log('⏳ Waiting for socket connection before joining...');
            socket.once('connect', () => {
              console.log('✅ Socket connected, now joining room...');
              socket.emit('join-room', { roomId, passcode, userName, persistentUserId });
            });
          }
        })
        .catch((error) => {
          console.error('❌ Authentication failed:', error);
          // Try to join anyway as guest
          const persistentUserId = localStorage.getItem('socketUserId');
          if (socket.connected) {
            socket.emit('join-room', { roomId, passcode, userName, persistentUserId });
          }
        });
    }

    scrollToBottom();

    return () => {
      console.log('🔌 Cleaning up socket event listeners and disconnecting from room');
      
      // Remove all specific event listeners
      socket.off('room-joined');
      socket.off('user-joined');
      socket.off('user-left');
      socket.off('new-message');
      socket.off('incoming-call');
      socket.off('call-accepted');
      socket.off('call-rejected');
      socket.off('call-ended');
      socket.off('webrtc-signal');
      
      // Clean up WebRTC
      if (webrtcManager.current) {
        webrtcManager.current.cleanup();
      }
      
      // Don't disconnect socket completely - just leave the room
      // The socket manager will handle disconnection when needed
      console.log('✅ Cleanup completed');
    };
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const sendMessage = () => {
    if (!newMessage.trim()) return;

    console.log('📤 Sending message:', newMessage.trim());
    const socket = getSocket();
    
    // Create a unique message ID for the outgoing message
    const messageId = `${socket.id}-${Date.now()}`;
    console.log('📤 Message ID generated:', messageId);
    
    // Add the message locally first to show immediate feedback
    const localMessage: Message = {
      id: messageId,
      userName: userName,
      content: newMessage.trim(),
      timestamp: new Date(),
      userId: getSocket().id || '',
      type: 'text'
    };
    
    console.log('📤 Adding local message:', localMessage);
    setMessages(prev => {
      if (!prev) return [localMessage];
      const exists = prev.some(msg => msg.id === localMessage.id);
      if (!exists) {
        return [...prev, localMessage];
      }
      return prev;
    });
    
    socket.emit('chat-message', {
      roomId,
      message: newMessage.trim(),
      messageId: messageId
    });

    setNewMessage('');
  };

  const startCall = async (callType: 'voice' | 'video') => {
    try {
      if (!webrtcManager.current) return;

      const stream = await webrtcManager.current.createLocalStream(callType === 'video');

      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }

      setCallState({
        isCalling: true,
        isInCall: false,
        callType,
        localStream: stream
      });

      // CRITICAL FIX: Set up remote stream callback BEFORE initiating call
      webrtcManager.current.onRemoteStream((remoteStream) => {
        console.log('📺 Received remote stream');
        if (remoteVideoRef.current) {
          remoteVideoRef.current.srcObject = remoteStream;
        }
        // Update state to show we're in a call - preserve localStream!
        setCallState(prev => ({
          ...prev,
          isCalling: false,
          isInCall: true,
          localStream: prev.localStream || stream  // Make sure we keep the local stream
        }));
      });

      const socket = getSocket();
      socket.emit('start-call', { roomId, callType });

      await webrtcManager.current.initiateCall(true);
    } catch (error: any) {
      console.error('Error starting call:', error);
      const errorMessage = error?.message || 'Failed to start call. Please check camera/microphone permissions.';
      alert(errorMessage);
    }
  };

  const acceptCall = async () => {
    if (!incomingCall || !webrtcManager.current) return;

    try {
      const stream = await webrtcManager.current.createLocalStream(incomingCall.callType === 'video');

      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }

      setCallState({
        isCalling: false,
        isInCall: true,
        callType: incomingCall.callType,
        localStream: stream
      });

      await webrtcManager.current.initiateCall(false);

      webrtcManager.current.onRemoteStream((remoteStream) => {
        if (remoteVideoRef.current) {
          remoteVideoRef.current.srcObject = remoteStream;
        }
      });

      const socket = getSocket();
      socket.emit('accept-call', { roomId, targetUserId: incomingCall.fromUser.id });

      setIncomingCall(null);
    } catch (error: any) {
      console.error('Error accepting call:', error);
      const errorMessage = error?.message || 'Failed to accept call. Please check camera/microphone permissions.';
      alert(errorMessage);
      setIncomingCall(null);
    }
  };

  const rejectCall = () => {
    if (!incomingCall) return;

    const socket = getSocket();
    socket.emit('call-rejected', { roomId, targetUserId: incomingCall.fromUser.id });
    setIncomingCall(null);
  };

  const endCall = (emitToServer: boolean = true) => {
    if (webrtcManager.current) {
      webrtcManager.current.cleanup();
    }

    if (localVideoRef.current) {
      localVideoRef.current.srcObject = null;
    }
    if (remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = null;
    }

    setCallState({
      isCalling: false,
      isInCall: false,
      callType: null,
    });

    // Reset audio/video controls
    setIsMuted(false);
    setIsVideoOff(false);

    // Only emit to server if we're the one ending the call, not when receiving end-call event
    if (emitToServer) {
      const socket = getSocket();
      socket.emit('end-call', { roomId });
    }
  };

  const toggleMute = () => {
    console.log('🎤 Toggle mute called');
    console.log('🎤 Call state:', callState);

    // Try multiple sources for the stream
    let localStream: MediaStream | null = null;

    // Method 1: From call state
    if (callState.localStream) {
      console.log('✅ Got stream from callState');
      localStream = callState.localStream;
    }
    // Method 2: From WebRTC manager
    else if (webrtcManager.current) {
      const managerStream = webrtcManager.current.getLocalStream();
      if (managerStream) {
        console.log('✅ Got stream from WebRTC manager');
        localStream = managerStream;
      }
    }
    // Method 3: From video element
    else if (localVideoRef.current && localVideoRef.current.srcObject) {
      console.log('✅ Got stream from video element');
      localStream = localVideoRef.current.srcObject as MediaStream;
    }

    if (!localStream) {
      console.error('❌ No local stream available from any source');
      return;
    }

    const audioTracks = localStream.getAudioTracks();
    console.log('🎤 Audio tracks found:', audioTracks.length);

    if (audioTracks.length === 0) {
      console.error('❌ No audio tracks in stream');
      return;
    }

    audioTracks.forEach((track, index) => {
      const oldState = track.enabled;
      track.enabled = !track.enabled;
      console.log(`🎤 Track ${index} (${track.label}): ${oldState} → ${track.enabled}`);
    });

    const newMutedState = !audioTracks[0].enabled;
    setIsMuted(newMutedState);
    console.log('🔇 Mute state updated:', newMutedState ? 'MUTED' : 'UNMUTED');
  };

  const toggleVideo = () => {
    console.log('📹 Toggle video called');
    console.log('📹 Call state:', callState);

    if (callState.callType !== 'video') {
      console.warn('⚠️ Not a video call, ignoring video toggle');
      return;
    }

    // Try multiple sources for the stream
    let localStream: MediaStream | null = null;

    // Method 1: From call state
    if (callState.localStream) {
      console.log('✅ Got stream from callState');
      localStream = callState.localStream;
    }
    // Method 2: From WebRTC manager
    else if (webrtcManager.current) {
      const managerStream = webrtcManager.current.getLocalStream();
      if (managerStream) {
        console.log('✅ Got stream from WebRTC manager');
        localStream = managerStream;
      }
    }
    // Method 3: From video element
    else if (localVideoRef.current && localVideoRef.current.srcObject) {
      console.log('✅ Got stream from video element');
      localStream = localVideoRef.current.srcObject as MediaStream;
    }

    if (!localStream) {
      console.error('❌ No local stream available from any source');
      return;
    }

    const videoTracks = localStream.getVideoTracks();
    console.log('📹 Video tracks found:', videoTracks.length);

    if (videoTracks.length === 0) {
      console.error('❌ No video tracks in stream');
      return;
    }

    videoTracks.forEach((track, index) => {
      const oldState = track.enabled;
      track.enabled = !track.enabled;
      console.log(`📹 Track ${index} (${track.label}): ${oldState} → ${track.enabled}`);
    });

    const newVideoOffState = !videoTracks[0].enabled;
    setIsVideoOff(newVideoOffState);
    console.log('📹 Video state updated:', newVideoOffState ? 'OFF' : 'ON');
  };

  return (
    <div className="min-h-screen d-flex flex-column" style={{ backgroundColor: '#1a1a2e', paddingTop: '100px' }}>
      {isOwner && (
        <div className="glass-morphism p-3 mb-3">
          <div className="d-flex justify-content-between align-items-center mb-2">
            <h6 className="mb-0 text-warning">
              <i className="bi bi-star-fill me-2"></i>
              {t('chatRoom.roomOwnerPanel')}
            </h6>
            <button
              className="btn btn-sm btn-outline-warning"
              onClick={() => setShowOwnerPanel(!showOwnerPanel)}
              title={showOwnerPanel ? 'Hide' : 'Show'}
            >
              <i className={`bi bi-chevron-${showOwnerPanel ? 'up' : 'down'}`}></i>
            </button>
          </div>

          {showOwnerPanel && (
            <div className="mt-3">
              <div className="d-flex flex-wrap gap-3 mb-3">
                <small className="text-secondary">
                  <strong>{t('chatRoom.roomId')}:</strong> {roomId}
                </small>
                <small className="text-secondary">
                  <strong>{t('chatRoom.passcode')}:</strong> {passcode}
                </small>
                <small className="text-secondary">
                  <strong>{t('chatRoom.shareUrl')}:</strong> {window.location.origin}/room/{roomId}
                </small>
              </div>
              <div className="d-flex gap-2">
                <button
                  className="btn btn-sm btn-outline-warning"
                  onClick={async () => {
                    const success = await copyToClipboard(roomId);
                    if (!success) {
                      alert(`${t('chatRoom.roomId')}: ${roomId}`);
                    }
                  }}
                  title={t('chatRoom.copyRoomId')}
                >
                  <i className="bi bi-clipboard me-1"></i>
                  {t('chatRoom.roomId')}
                </button>
                <button
                  className="btn btn-sm btn-outline-warning"
                  onClick={async () => {
                    const success = await copyToClipboard(passcode);
                    if (!success) {
                      alert(`${t('chatRoom.passcode')}: ${passcode}`);
                    }
                  }}
                  title={t('chatRoom.copyPasscode')}
                >
                  <i className="bi bi-key me-1"></i>
                  {t('chatRoom.passcode')}
                </button>
                <button
                  className="btn btn-sm btn-outline-primary"
                  onClick={async () => {
                    const shareUrl = `${window.location.origin}/room/${roomId}`;
                    const success = await copyToClipboard(shareUrl);
                    if (!success) {
                      alert(`${t('chatRoom.shareUrl')}: ${shareUrl}`);
                    }
                  }}
                  title={t('chatRoom.copyShareLink')}
                >
                  <i className="bi bi-link me-1"></i>
                  {t('chatRoom.shareUrl')}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
      
      <header className="glass-morphism p-3 mb-3">
        <div className="d-flex justify-content-between align-items-center">
          <div>
            <h5 className="mb-1">
              <i className="bi bi-chat-dots-fill text-primary me-2"></i>
              {t('chatRoom.room')}: {roomId}
            </h5>
            <small className="text-secondary">
              {(users?.length || 0) + 1} {(users?.length || 0) + 1 === 1 ? t('chatRoom.participant') : t('chatRoom.participants')}
              <span className="d-block">
                <i className="bi bi-people-fill me-1"></i>
                {userName} ({t('chatRoom.you')}){users && users.length > 0 && ` + ${users.length} ${users.length > 1 ? t('chatRoom.others') : t('chatRoom.other')}`}
              </span>
            </small>
          </div>
          
          <div className="d-flex gap-2">
            <button
              className="btn btn-success"
              onClick={() => startCall('voice')}
              disabled={callState.isCalling || callState.isInCall}
            >
              <i className="bi bi-telephone-fill"></i>
            </button>
            <button
              className="btn btn-primary"
              onClick={() => startCall('video')}
              disabled={callState.isCalling || callState.isInCall}
            >
              <i className="bi bi-camera-video-fill"></i>
            </button>
            {callState.isInCall && (
              <button
                className="btn btn-danger"
                onClick={() => endCall()}
              >
                <i className="bi bi-telephone-x-fill"></i>
              </button>
            )}
          </div>
        </div>
      </header>

      <div className="flex-grow-1 d-flex">
        <div className="col-8 p-3">
          <div className="glass-morphism h-100 d-flex flex-column">
            <div className="flex-grow-1 overflow-auto p-3" style={{ maxHeight: '400px' }}>
              {(!messages || messages.length === 0) ? (
                <div className="text-center text-muted py-5">
                  <i className="bi bi-chat-dots" style={{ fontSize: '3rem' }}></i>
                  <p className="mt-3">{t('chatRoom.noMessages')}</p>
                </div>
              ) : (
                messages && messages.map((message, index) => {
                  console.log(`📋 Rendering message ${index}:`, message);
                  const currentSocket = getSocket();
                  return (
                    <div
                      key={`${message?.id}-${index}`}
                      className={`mb-3 ${message?.userId === currentSocket.id ? 'text-end' : ''}`}
                    >
                      <div
                        className={`d-inline-block px-3 py-2 rounded ${
                          message?.userId === currentSocket.id
                            ? 'bg-primary text-white'
                            : 'bg-secondary bg-opacity-25 text-white'
                        }`}
                      >
                        <div className="small text-secondary">{message?.userName}</div>
                        <div>{message?.content}</div>
                        <div className="small text-muted">{formatTime(message?.timestamp)}</div>
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            <div className="p-3 border-top border-secondary">
              <div className="input-group">
                <input
                  type="text"
                  className="form-control"
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  placeholder={t('chatRoom.typeMessage')}
                  onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
                />
                <button
                  className="btn btn-primary"
                  onClick={sendMessage}
                  disabled={!newMessage.trim()}
                >
                  <i className="bi bi-send-fill"></i>
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="col-4 p-3">
          <div className="glass-morphism p-3 mb-3">
            <h6 className="mb-3">
              <i className="bi bi-people-fill me-2"></i>
              {t('chatRoom.participants')}
            </h6>
            <div className="list-group">
              {/* Current user (owner) - Single entry */}
              <div className="list-group-item bg-transparent text-white border-secondary">
                <i className="bi bi-person-circle me-2"></i>
                {userName}
                <span className="badge bg-primary ms-2">{t('chatRoom.you')}</span>
                {isOwner && <span className="badge bg-warning ms-1">{t('chatRoom.host')}</span>}
              </div>

              {/* Other users */}
              {users && users.map((user, index) => {
                console.log(`🧑 User ${index} in list:`, user);
                const uniqueKey = user?.id || user?.name || `user-${index}`;
                console.log(`🧑 Rendering user ${user?.name} with key: ${uniqueKey}`);
                return (
                  <div
                    key={uniqueKey}
                    className="list-group-item bg-transparent text-white border-secondary"
                  >
                    <i className="bi bi-person-circle me-2"></i>
                    {user?.name || 'Unknown User'}
                    {user?.isHost && <span className="badge bg-warning ms-2">{t('chatRoom.host')}</span>}
                  </div>
                );
              })}
            </div>
          </div>

          {(callState.isInCall || callState.isCalling) && (
            <div className="glass-morphism p-3">
              <h6 className="mb-3">
                <i className="bi bi-camera-video me-2"></i>
                {callState.isCalling ? t('chatRoom.calling') : t('chatRoom.inCall')}
              </h6>
              
              <div className="video-container mb-2" style={{ height: '150px' }}>
                <video
                  ref={localVideoRef}
                  autoPlay
                  muted
                  playsInline
                  className="w-100 h-100"
                />
              </div>
              
              {callState.isInCall && (
                <div className="video-container mb-3" style={{ height: '150px' }}>
                  <video
                    ref={remoteVideoRef}
                    autoPlay
                    playsInline
                    className="w-100 h-100"
                  />
                </div>
              )}

              {/* Audio/Video Controls */}
              {callState.isInCall && (
                <div className="d-flex gap-2 justify-content-center">
                  <button
                    className={`btn ${isMuted ? 'btn-danger' : 'btn-secondary'}`}
                    onClick={toggleMute}
                    title={isMuted ? t('chatRoom.unmute') : t('chatRoom.mute')}
                  >
                    <i className={`bi ${isMuted ? 'bi-mic-mute-fill' : 'bi-mic-fill'}`}></i>
                  </button>

                  {callState.callType === 'video' && (
                    <button
                      className={`btn ${isVideoOff ? 'btn-danger' : 'btn-secondary'}`}
                      onClick={toggleVideo}
                      title={isVideoOff ? t('chatRoom.videoOn') : t('chatRoom.videoOff')}
                    >
                      <i className={`bi ${isVideoOff ? 'bi-camera-video-off-fill' : 'bi-camera-video-fill'}`}></i>
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {incomingCall && (
        <div className="position-fixed top-50 start-50 translate-middle glass-morphism p-4" style={{ zIndex: 1000 }}>
          <h6 className="mb-3">
            <i className="bi bi-telephone-fill me-2"></i>
            {t('chatRoom.incomingCall')} {incomingCall.callType} {t('chatRoom.call')}
          </h6>
          <p className="mb-3">{t('chatRoom.from')}: {incomingCall.fromUser.name}</p>
          <div className="d-flex gap-2">
            <button
              className="btn btn-success"
              onClick={acceptCall}
            >
              <i className="bi bi-telephone-fill me-1"></i>
              {t('chatRoom.accept')}
            </button>
            <button
              className="btn btn-danger"
              onClick={rejectCall}
            >
              <i className="bi bi-telephone-x-fill me-1"></i>
              {t('chatRoom.reject')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}