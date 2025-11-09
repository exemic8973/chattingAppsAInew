'use client';

import { useState, useEffect, useRef } from 'react';
import { getSocket, initializeSocket } from '@/lib/socket';
import { WebRTCManager } from '@/lib/webrtc';
import { User, Message, CallState } from '@/types';
import { formatTime, copyToClipboard } from '@/lib/utils';

interface ChatRoomProps {
  roomId: string;
  userName: string;
  passcode: string;
  isOwner?: boolean;
}

export default function ChatRoom({ roomId, userName, passcode, isOwner = false }: ChatRoomProps) {
  const [users, setUsers] = useState<User[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [callState, setCallState] = useState<CallState>({
    isCalling: false,
    isInCall: false,
    callType: null,
  });
  const [incomingCall, setIncomingCall] = useState<{
    fromUser: User;
    callType: 'voice' | 'video';
  } | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const webrtcManager = useRef<WebRTCManager | null>(null);

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

    // Function to join room with proper connection verification
    const joinRoomWithVerification = async () => {
      console.log('🚪 Attempting to join room with verification...');
      
      return new Promise((resolve, reject) => {
        let joinTimeout: NodeJS.Timeout;
        let hasJoined = false;
        
        // Set up event listeners BEFORE joining
        const cleanup = () => {
          socket.off('room-joined', handleRoomJoined);
          socket.off('error', handleError);
          if (joinTimeout) clearTimeout(joinTimeout);
        };
        
        const handleRoomJoined = (data: any) => {
          console.log('✅ Room joined successfully:', data);
          hasJoined = true;
          cleanup();
          resolve(data);
        };
        
        const handleError = (error: any) => {
          console.log('❌ Room join error:', error);
          cleanup();
          reject(error);
        };
        
        // Set timeout for room joining
        joinTimeout = setTimeout(() => {
          if (!hasJoined) {
            console.log('⏰ Room join timeout - retrying...');
            cleanup();
            // Retry once
            attemptJoin();
          }
        }, 5000);
        
        const attemptJoin = () => {
          console.log('🚀 Sending join-room event:', { roomId, userName, passcode });
          socket.emit('join-room', { roomId, passcode, userName });
        };
        
        // Set up listeners
        socket.on('room-joined', handleRoomJoined);
        socket.on('error', handleError);
        
        // Start the join process
        if (socket.connected) {
          attemptJoin();
        } else {
          console.log('⏳ Waiting for socket connection...');
          socket.once('connect', () => {
            console.log('✅ Socket connected, now joining room...');
            attemptJoin();
          });
        }
      });
    };

    // Join the room with verification
    joinRoomWithVerification()
      .then((data) => {
        console.log('🎉 Successfully joined room:', data);
        // Room-joined event will be handled by the existing listener
      })
      .catch((error) => {
        console.error('❌ Failed to join room:', error);
        alert('Failed to join room. Please refresh and try again.');
      });

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

    socket.on('user-joined', ({ userName, user }) => {
      console.log('👤 New user joined event received:', userName, user);
      console.log('📊 Current users before adding:', users);
      
      if (user && user.id && user.name) {
        setUsers(prev => {
          console.log('📊 Previous users:', prev);
          // Check if user already exists
          const exists = prev.some(u => u.id === user.id);
          if (exists) {
            console.log('⚠️ User already exists, skipping:', user.id);
            return prev;
          }
          const newUsers = [...prev, user];
          console.log('📊 New users after adding:', newUsers);
          console.log(`📊 Total participants now: ${newUsers.length + 1}`); // +1 for current user
          return newUsers;
        });
      } else {
        console.log('⚠️ Invalid user data received in user-joined event:', user);
      }
    });

    socket.on('user-left', (userName: string) => {
      console.log('👤 User left:', userName);
      setUsers(prev => prev.filter(user => user.name !== userName));
    });

    // 🔥 CRITICAL FIX: Handle new user joining the room
    socket.on('user-joined', (data: { user: { id: string; name: string; isHost: boolean }, participantCount: number }) => {
      console.log('👤 New user joined:', data.user);
      console.log('📊 Participant count:', data.participantCount);
      
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

    socket.on('new-message', (message: Message) => {
      console.log('💬 New message received:', message);
      console.log('📊 Current messages before adding:', messages);
      
      // Add safety checks for message data
      if (!message || !message.id || !message.message) {
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
      endCall();
    });

    socket.on('webrtc-signal', async ({ signalData, fromUserId }) => {
      if (webrtcManager.current) {
        webrtcManager.current.signal(signalData);
      }
    });

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
    const localMessage = {
      id: messageId,
      userName: userName,
      message: newMessage.trim(),
      timestamp: new Date().toISOString(),
      userId: getSocket().id
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

      const socket = getSocket();
      socket.emit('start-call', { roomId, callType });

      await webrtcManager.current.initiateCall(true);
    } catch (error) {
      console.error('Error starting call:', error);
      alert('Failed to start call. Please check camera/microphone permissions.');
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
      socket.emit('call-accepted', { roomId, targetUserId: incomingCall.fromUser.id });

      setIncomingCall(null);
    } catch (error) {
      console.error('Error accepting call:', error);
      alert('Failed to accept call. Please check camera/microphone permissions.');
    }
  };

  const rejectCall = () => {
    if (!incomingCall) return;

    const socket = getSocket();
    socket.emit('call-rejected', { roomId, targetUserId: incomingCall.fromUser.id });
    setIncomingCall(null);
  };

  const endCall = () => {
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

    const socket = getSocket();
    socket.emit('end-call', { roomId });
  };

  return (
    <div className="min-h-screen d-flex flex-column" style={{ backgroundColor: '#1a1a2e', paddingTop: '20px' }}>
      {isOwner && (
        <div className="glass-morphism p-3 mb-3">
          <div className="d-flex justify-content-between align-items-center">
            <div>
              <h6 className="mb-1 text-warning">
                <i className="bi bi-star-fill me-2"></i>
                Room Owner Panel
              </h6>
              <div className="d-flex flex-wrap gap-3">
                <small className="text-secondary">
                  <strong>Room ID:</strong> {roomId}
                </small>
                <small className="text-secondary">
                  <strong>Passcode:</strong> {passcode}
                </small>
                <small className="text-secondary">
                  <strong>Share URL:</strong> {window.location.origin}/room/{roomId}
                </small>
              </div>
            </div>
            <div className="d-flex gap-2">
              <button
                className="btn btn-sm btn-outline-warning"
                onClick={async () => {
                  const success = await copyToClipboard(roomId);
                  if (!success) {
                    alert(`Room ID: ${roomId}`);
                  }
                }}
                title="Copy Room ID"
              >
                <i className="bi bi-clipboard"></i>
              </button>
              <button
                className="btn btn-sm btn-outline-warning"
                onClick={async () => {
                  const success = await copyToClipboard(passcode);
                  if (!success) {
                    alert(`Passcode: ${passcode}`);
                  }
                }}
                title="Copy Passcode"
              >
                <i className="bi bi-key"></i>
              </button>
              <button
                className="btn btn-sm btn-outline-primary"
                onClick={async () => {
                  const shareUrl = `${window.location.origin}/room/${roomId}`;
                  const success = await copyToClipboard(shareUrl);
                  if (!success) {
                    alert(`Share URL: ${shareUrl}`);
                  }
                }}
                title="Copy Share Link"
              >
                <i className="bi bi-link"></i>
              </button>
            </div>
          </div>
        </div>
      )}
      
      <header className="glass-morphism p-3 mb-3">
        <div className="d-flex justify-content-between align-items-center">
          <div>
            <h5 className="mb-1">
              <i className="bi bi-chat-dots-fill text-primary me-2"></i>
              Room: {roomId}
            </h5>
            <small className="text-secondary">
              {console.log(`📊 Participant count calculation: users.length=${users?.length || 0}, total=${(users?.length || 0) + 1}`)}
              {(users?.length || 0) + 1} participant{(users?.length || 0) !== 0 ? 's' : ''}
              <span className="d-block">
                <i className="bi bi-people-fill me-1"></i>
                {userName} (You){users && users.length > 0 && ` + ${users.length} other${users.length > 1 ? 's' : ''}`}
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
                onClick={endCall}
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
                  <p className="mt-3">No messages yet. Start the conversation!</p>
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
                        <div>{message?.message}</div>
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
                  placeholder="Type a message..."
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
              Participants
            </h6>
            <div className="list-group">
              {/* Current user (owner) - Single entry */}
              <div className="list-group-item bg-transparent text-white border-secondary">
                <i className="bi bi-person-circle me-2"></i>
                {userName}
                <span className="badge bg-primary ms-2">You</span>
                {isOwner && <span className="badge bg-warning ms-1">Host</span>}
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
                    {user?.isHost && <span className="badge bg-warning ms-2">Host</span>}
                  </div>
                );
              })}
            </div>
          </div>

          {(callState.isInCall || callState.isCalling) && (
            <div className="glass-morphism p-3">
              <h6 className="mb-3">
                <i className="bi bi-camera-video me-2"></i>
                {callState.isCalling ? 'Calling...' : 'In Call'}
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
                <div className="video-container" style={{ height: '150px' }}>
                  <video
                    ref={remoteVideoRef}
                    autoPlay
                    playsInline
                    className="w-100 h-100"
                  />
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
            Incoming {incomingCall.callType} call
          </h6>
          <p className="mb-3">From: {incomingCall.fromUser.name}</p>
          <div className="d-flex gap-2">
            <button
              className="btn btn-success"
              onClick={acceptCall}
            >
              <i className="bi bi-telephone-fill me-1"></i>
              Accept
            </button>
            <button
              className="btn btn-danger"
              onClick={rejectCall}
            >
              <i className="bi bi-telephone-x-fill me-1"></i>
              Reject
            </button>
          </div>
        </div>
      )}
    </div>
  );
}