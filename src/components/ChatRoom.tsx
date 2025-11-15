'use client';

import { useState, useEffect, useRef } from 'react';
import { getSocket, initializeSocket } from '@/lib/socket';
import { MultiPeerManager } from '@/lib/webrtc';
import { User, Message, CallState } from '@/types';
import { formatTime, copyToClipboard } from '@/lib/utils';
import { useLanguage } from '@/contexts/LanguageContext';
import { detectSpeaking } from '@/lib/audioDetection';
import MeetingHeader from './meeting/MeetingHeader';
import VideoGallery from './meeting/VideoGallery';
import MeetingControls from './meeting/MeetingControls';
import SidePanel from './meeting/SidePanel';

// Module-level state to persist across React Strict Mode mounts
// Track per room to avoid conflicts between different rooms
const roomInitState = new Map<string, { listenersSetUp: boolean; hasJoinedRoom: boolean }>();

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
  const [isMuted, setIsMuted] = useState(true);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [showChat, setShowChat] = useState(true);
  const [showParticipants, setShowParticipants] = useState(false);
  const [localIsSpeaking, setLocalIsSpeaking] = useState(false);
  const [hostMutedUsers, setHostMutedUsers] = useState<Set<string>>(new Set());
  const [isHostMuted, setIsHostMuted] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const webrtcManager = useRef<MultiPeerManager | null>(null);
  const isMountedRef = useRef(true); // Track if component is mounted

  useEffect(() => {
    console.log('🚀 Initializing ChatRoom...');
    console.log('📊 Initial state - Users:', users.length, 'Messages:', messages.length);
    isMountedRef.current = true; // Mark as mounted

    // Get or create room init state (persists across React Strict Mode mounts)
    if (!roomInitState.has(roomId)) {
      roomInitState.set(roomId, { listenersSetUp: false, hasJoinedRoom: false });
    }
    const initState = roomInitState.get(roomId)!;
    console.log('📍 Room ID:', roomId);
    console.log('👤 User Name:', userName);
    console.log('🔑 Passcode:', passcode);
    console.log('⭐ Is Owner:', isOwner);

    const socket = getSocket();
    console.log('🔌 Socket initialized with ID:', socket.id);
    console.log('📡 Socket connected:', socket.connected);
    
    // 🔥 CRITICAL FIX: Ensure socket is connected before proceeding - ENHANCED VERSION
    
    // Function to handle socket connection success - DEFINED BEFORE USE
    const handleSocketConnected = () => {
      console.log('🎯 Socket connection established, proceeding with setup...');
      
      // Continue with the rest of the setup logic
      webrtcManager.current = new MultiPeerManager();
      
      // Set up WebRTC signal handler to relay signals via Socket.IO
      webrtcManager.current.onSignal((payload) => {
        console.log('📡 Emitting WebRTC signal to server:', payload);
        socket.emit('webrtc-signal', {
          roomId,
          signalData: payload.signalData,
          targetUserId: payload.to
        });
      });
      
      // Continue with the rest of the setup...
      console.log('🎯 Socket connection setup completed');
    };

    if (!socket.connected) {
      console.log('🔌 Socket not connected, attempting to connect...');
      
      // Try to connect with better error handling
      try {
        socket.connect();
        console.log('📤 Socket connect() called, waiting for connection...');
        
        // Wait for connection with extended timeout for better reliability
        const connectionTimeout = setTimeout(() => {
          console.log('⏰ Socket connection timeout after 10 seconds');
          if (!socket.connected) {
            console.log('❌ Socket failed to connect after timeout');
            // Don't show error immediately - let the socket manager handle reconnection
          }
        }, 10000);
        
        socket.once('connect', () => {
          clearTimeout(connectionTimeout);
          console.log('✅ Socket connected successfully!');
          console.log('🔌 New Socket ID:', socket.id);
          
          // Now proceed with the connection-dependent logic
          handleSocketConnected();
        });
        
        socket.once('connect_error', (error) => {
          clearTimeout(connectionTimeout);
          console.log('❌ Socket connection error:', error);
        });
        
      } catch (error) {
        console.log('❌ Error calling socket.connect():', error);
      }
    } else {
      console.log('✅ Socket already connected, proceeding immediately');
      handleSocketConnected();
    }

    webrtcManager.current = new MultiPeerManager();

    // Set up WebRTC signal handler to relay signals via Socket.IO
    webrtcManager.current.onSignal((payload) => {
      console.log('📡 Emitting WebRTC signal to server:', payload);
      socket.emit('webrtc-signal', {
        roomId,
        signalData: payload.signalData,
        targetUserId: payload.to
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

    // 🔥 CRITICAL FIX: Set up event listeners only once (persistent across React Strict Mode mounts)
    if (!initState.listenersSetUp) {
      console.log('📡 Setting up socket event listeners...');
      initState.listenersSetUp = true;

      socket.on('room-joined', ({ roomId, users, messages }) => {
      console.log('🎯 ROOM-JOINED EVENT RECEIVED');
      console.log('📍 Room ID:', roomId);
      console.log('👥 Participants count:', users?.length || 0);
      console.log('👥 Participants data:', users);
      console.log('💬 Messages count:', messages?.length || 0);
      console.log('💬 Messages data:', messages);
      
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
        webrtcManager.current.signal(fromUserId, signalData);
      }
    });

    // Host mute events
    socket.on('participant-muted-by-host', (data: { roomId: string; mutedBy: string }) => {
      console.log(`🔇 You have been muted by host: ${data.mutedBy}`);
      setIsHostMuted(true);

      // Force mute the user
      if (callState.localStream) {
        const audioTrack = callState.localStream.getAudioTracks()[0];
        if (audioTrack) {
          audioTrack.enabled = false;
          setIsMuted(true);
          console.log('🔇 Audio forcibly muted by host');
        }
      }
    });

    socket.on('participant-mute-status', (data: { userId: string; isMuted: boolean; mutedByHost: boolean }) => {
      console.log(`🔇 Participant mute status update:`, data);

      if (data.mutedByHost) {
        setHostMutedUsers(prev => {
          const newSet = new Set(prev);
          if (data.isMuted) {
            newSet.add(data.userId);
          } else {
            newSet.delete(data.userId);
          }
          return newSet;
        });
      }
    });
    } // End of if (!initState.listenersSetUp)

    // 🔥 CRITICAL FIX: Ensure event listeners are active BEFORE joining room
    // This must happen before emitting update-owner-socket or join-room events
    console.log('🔍 Verifying socket event listeners are active...');
    console.log('📡 Socket has event listeners:', socket.hasListeners('user-joined'));
    console.log('🔍 Socket connected:', socket.connected);
    console.log('🔍 Socket ID:', socket.id);
    console.log('🔍 Is Owner:', isOwner);
    
    // Force re-attachment of critical event listeners for host
    if (isOwner) {
      console.log('👑 Host detected, ensuring critical event listeners are attached...');
      
      // Remove any existing listeners to prevent duplicates
      socket.off('user-joined');
      socket.off('user-left');
      socket.off('new-message');
      
      // Re-attach the critical listeners with enhanced debugging
      socket.on('user-joined', (data: { userName?: string; user: { id: string; name: string; isHost: boolean }; participantCount?: number }) => {
        console.log('👤 [HOST] RECEIVED user-joined EVENT:', data);
        console.log('👤 [HOST] Current users before update:', users);
        console.log('📊 [HOST] Participant count:', data.participantCount);

        if (!data.user || !data.user.id || !data.user.name) {
          console.log('⚠️ [HOST] Invalid user data received in user-joined event:', data.user);
          return;
        }

        setUsers(prev => {
          console.log('👥 [HOST] Previous users state:', prev);
          const exists = prev.some(user => user.id === data.user.id);
          if (exists) {
            console.log('⚠️ [HOST] User already exists, skipping:', data.user.name);
            return prev;
          }

          const newUsers = [...prev, {
            id: data.user.id,
            name: data.user.name,
            isHost: data.user.isHost
          }];
          console.log('👥 [HOST] Updated users list:', newUsers);
          return newUsers;
        });
      });

      socket.on('user-left', (userName: string) => {
        console.log('👤 [HOST] RECEIVED user-left EVENT:', userName);
        setUsers(prev => prev.filter(user => user.name !== userName));
      });

      socket.on('new-message', (message: Message) => {
        console.log('💬 [HOST] RECEIVED new-message EVENT:', message);
        
        if (!message || !message.id || !message.content) {
          console.log('⚠️ [HOST] Invalid message data received:', message);
          return;
        }
        
        setMessages(prev => {
          const exists = prev.some(msg => msg.id === message.id);
          if (exists) {
            console.log('⚠️ [HOST] Message already exists, skipping:', message.id);
            return prev;
          }
          const newMessages = [...prev, message];
          console.log('📊 [HOST] New messages after adding:', newMessages);
          return newMessages;
        });
      });

      // Add a test event listener to verify socket is working
      socket.on('test-event', (data) => {
        console.log('🔥 [HOST] RECEIVED test-event:', data);
      });

      // Add debug response listener
      socket.on('debug-response', (data) => {
        console.log('🔥 [HOST] RECEIVED debug-response:', data);
      });

      console.log('✅ [HOST] All critical event listeners re-attached');
    }

    // 🔐 Authenticate and join room (only once, even in React Strict Mode)
    // IMPORTANT: Owner doesn't need to join - they're already in the room from creation!
    if (!initState.hasJoinedRoom) {
      console.log('🔐 Starting authentication and room join process...');

      if (isOwner) {
        console.log('👑 User is owner - updating socket ID in room');

        // Owner needs to update their socket ID since they disconnected after creating room
        authenticateSocket()
          .then(() => {
            // Check if component is still mounted before executing
            if (!isMountedRef.current) {
              console.log('⏭️ Component unmounted during auth, NOT marking as joined');
              // Don't set hasJoinedRoom = true so the second mount can try again
              return;
            }

            console.log('✅ Owner authentication complete, now updating socket in room...');

            // 🔥 CRITICAL FIX: Handle owner socket update more robustly
            const proceedWithSocketUpdate = async () => {
              try {
                console.log('📤 Attempting to emit update-owner-socket event...');
                
                // Wait a bit to ensure everything is properly initialized
                await new Promise(resolve => setTimeout(resolve, 200));
                
                if (!isMountedRef.current) {
                  console.log('⏭️ Component unmounted during socket update');
                  return;
                }
                
                console.log('📤 Emitting update-owner-socket event with:', { roomId, passcode });
                socket.emit('update-owner-socket', { roomId, passcode });
                
                initState.hasJoinedRoom = true;
                console.log('✅ Successfully marked room as joined after owner socket update');
                
              } catch (error) {
                console.log('❌ Error in owner socket update:', error);
                // Don't mark as joined if there's an error - let it retry
              }
            };

            // Try to proceed immediately, but handle connection issues gracefully
            if (socket.connected) {
              console.log('✅ Socket connected, proceeding with owner update');
              proceedWithSocketUpdate();
            } else {
              console.log('⏳ Socket not connected yet, will proceed when connected');
              socket.once('connect', proceedWithSocketUpdate);
            }
          })
          .catch((error) => {
            if (!isMountedRef.current) return; // Don't process errors if unmounted

            console.error('❌ Owner authentication failed:', error);
            // Try to update socket anyway with passcode
            if (socket.connected) {
              socket.emit('update-owner-socket', { roomId, passcode });
            }
            // Initialize empty state
            setUsers([]);
            setMessages([]);
          });
      } else {
        console.log('🚀 Starting authentication and room join process...');

        authenticateSocket()
          .then(() => {
            // Check if component is still mounted before executing
            if (!isMountedRef.current) {
              console.log('⏭️ Component unmounted, skipping room join');
              return;
            }

            console.log('✅ Socket authentication complete, now joining room...');

            // Send join-room event
            const persistentUserId = localStorage.getItem('socketUserId');
            console.log('🚀 Sending join-room event:', { roomId, userName, passcode, persistentUserId });

            if (socket.connected) {
              socket.emit('join-room', { roomId, passcode, userName, persistentUserId });
            } else {
              console.log('⏳ Waiting for socket connection before joining...');
              socket.once('connect', () => {
                if (!isMountedRef.current) return; // Check again before emitting
                console.log('✅ Socket connected, now joining room...');
                socket.emit('join-room', { roomId, passcode, userName, persistentUserId });
              });
            }
          })
          .catch((error) => {
            if (!isMountedRef.current) return; // Don't process errors if unmounted

            console.error('❌ Authentication failed:', error);
            // Try to join anyway as guest
            const persistentUserId = localStorage.getItem('socketUserId');
            if (socket.connected) {
              socket.emit('join-room', { roomId, passcode, userName, persistentUserId });
            }
          });
      }
    } // End of if (!initState.hasJoinedRoom)

    scrollToBottom();

    return () => {
      console.log('🔌 Cleaning up ChatRoom component');
      isMountedRef.current = false; // Mark as unmounted to prevent stale async operations

      // Don't remove socket event listeners - they should persist across React Strict Mode mounts
      // Only clean up WebRTC and other resources

      // Clean up WebRTC
      if (webrtcManager.current) {
        webrtcManager.current.cleanupAll();
      }

      // Don't disconnect socket completely - just leave the room
      // The socket manager will handle disconnection when needed
      console.log('✅ Cleanup completed');
    };
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Speaking detection for local stream
  useEffect(() => {
    if (!callState.localStream) {
      setLocalIsSpeaking(false);
      return;
    }

    const audioTracks = callState.localStream.getAudioTracks();
    if (audioTracks.length === 0) {
      return;
    }

    console.log('🎤 Setting up speaking detection for local stream');
    const cleanup = detectSpeaking(callState.localStream, (isSpeaking) => {
      setLocalIsSpeaking(isSpeaking);
      if (isSpeaking) {
        console.log('🗣️ Local user is speaking');
      }
    });

    return () => {
      console.log('🎤 Cleaning up speaking detection');
      cleanup();
    };
  }, [callState.localStream]);

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
      webrtcManager.current.onRemoteStream((remoteId, remoteStream) => {
        console.log('📺 Received remote stream from', remoteId);
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

      // Note: MultiPeerManager doesn't have a global initiateCall method
      // It uses initiateCallTo for specific peers
      console.log('📞 Call initiated - MultiPeerManager will handle peer connections as needed');
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

      // Note: MultiPeerManager uses initiateCallTo for specific peers
      // The call will be handled when the other peer responds

      webrtcManager.current.onRemoteStream((remoteId, remoteStream) => {
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
      webrtcManager.current.cleanupAll();
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

  // Helper function to handle leaving the meeting
  const handleLeaveMeeting = () => {
    // Clean up call if in progress
    if (callState.isInCall || callState.isCalling) {
      endCall(true);
    }

    // Navigate back to home
    window.location.href = '/';
  };

  // Toggle chat panel
  const handleToggleChat = () => {
    setShowChat(!showChat);
    if (!showChat) {
      setShowParticipants(false);
    }
  };

  // Toggle participants panel
  const handleToggleParticipants = () => {
    setShowParticipants(!showParticipants);
    if (!showParticipants) {
      setShowChat(false);
    }
  };

  // Mute participant (host only)
  const handleMuteParticipant = (userId: string) => {
    if (!isOwner) {
      console.warn('⚠️ Only the host can mute participants');
      return;
    }

    console.log(`🔇 Host muting participant: ${userId}`);
    const socket = getSocket();
    socket.emit('host-mute-participant', {
      roomId,
      targetUserId: userId
    });
  };

  // Debug function to test socket connection
  const testSocketConnection = () => {
    const socket = getSocket();
    console.log('🔍 Testing socket connection...');
    console.log('🔍 Socket connected:', socket.connected);
    console.log('🔍 Socket ID:', socket.id);
    console.log('🔍 Room ID:', roomId);
    console.log('🔍 Is Owner:', isOwner);
    
    if (!socket.connected) {
      console.log('🔌 Socket not connected, attempting manual connection...');
      socket.connect();
      
      socket.once('connect', () => {
        console.log('✅ Socket connected successfully!');
        console.log('🔌 New Socket ID:', socket.id);
        
        // Now test the events
        socket.emit('test-event', { message: 'Hello from client after reconnection', timestamp: Date.now() });
        
        if (isOwner) {
          socket.emit('debug-host-test', { roomId, message: 'Host debug test after reconnection' });
          console.log('📤 Sent debug-host-test event after reconnection');
        }
      });
    } else {
      // Test emit and see if we get a response
      socket.emit('test-event', { message: 'Hello from client', timestamp: Date.now() });
      
      // Test if we can emit to the room
      if (isOwner) {
        socket.emit('debug-host-test', { roomId, message: 'Host debug test' });
        console.log('📤 Sent debug-host-test event');
      }
    }
  };

  // 🔥 CRITICAL FIX: Detect refresh and ensure proper room state
  useEffect(() => {
    const currentRoomInitState = roomInitState.get(roomId);
    if (userName && passcode && currentRoomInitState && !currentRoomInitState.hasJoinedRoom) {
      console.log('🎯 REFRESH DETECTED - Ensuring proper room state');
      console.log('📋 Current state - Users:', users.length, 'Messages:', messages.length);
      console.log('👤 User credentials:', { userName, passcode, isOwner });
      console.log('📍 Room init state:', currentRoomInitState);
      
      // Force refresh of room state
      const socket = getSocket();
      if (socket.connected) {
        console.log('✅ Socket connected, forcing room state refresh');
        
        if (isOwner) {
          console.log('👑 Owner detected, updating socket in room');
          socket.emit('update-owner-socket', { roomId, passcode });
        } else {
          console.log('👤 Regular user, joining room with credentials');
          const persistentUserId = localStorage.getItem('socketUserId');
          socket.emit('join-room', { roomId, passcode, userName, persistentUserId });
        }
        
        currentRoomInitState.hasJoinedRoom = true;
      } else {
        console.log('⏳ Socket not connected, will retry when connected');
        socket.once('connect', () => {
          if (!isMountedRef.current) return;
          console.log('✅ Socket now connected, proceeding with refresh');
          
          if (isOwner) {
            socket.emit('update-owner-socket', { roomId, passcode });
          } else {
            const persistentUserId = localStorage.getItem('socketUserId');
            socket.emit('join-room', { roomId, passcode, userName, persistentUserId });
          }
          
          currentRoomInitState.hasJoinedRoom = true;
        });
      }
    }
  }, [userName, passcode, isOwner, roomId]);

  // Prepare participants data for VideoGallery (exclude self, only show others)
  const participants = users.map(user => ({
    ...user,
    isMuted: hostMutedUsers.has(user.id),
    isVideoOff: false, // TODO: Track remote video state
    isSpeaking: false // TODO: Track remote speaking state
  }));

  // Prepare remote streams as Map (currently only 1-to-1 supported)
  const remoteStreams = new Map<string, { stream: MediaStream; userName?: string }>();
  if (callState.isInCall && remoteVideoRef.current?.srcObject) {
    // For now, use first other user's ID as remote stream key
    const remoteUser = users[0];
    if (remoteUser) {
      remoteStreams.set(remoteUser.id, {
        stream: remoteVideoRef.current.srcObject as MediaStream,
        userName: remoteUser.name
      });
    }
  }

  return (
    <div className="teams-meeting-container">
      {/* Meeting Header */}
      <MeetingHeader
        roomId={roomId}
        participantCount={users.length + 1}
        passcode={passcode}
        isHost={isOwner}
        onLeave={handleLeaveMeeting}
      />

      

      {/* Main Content Area */}
      <div className="meeting-content">
        {/* Video Gallery */}
        <div className={`video-gallery-wrapper ${(showChat || showParticipants) ? 'with-sidebar' : ''}`}>
          <VideoGallery
            localStream={callState.localStream || null}
            localUserName={userName}
            localIsMuted={isMuted}
            localIsVideoOff={isVideoOff}
            localIsSpeaking={localIsSpeaking}
            participants={participants}
            remoteStreams={remoteStreams}
            isHost={isOwner}
          />
        </div>

        {/* Side Panel (Chat/Participants) */}
        {(showChat || showParticipants) && (
          <div className="side-panel-wrapper">
            <SidePanel
              messages={messages}
              participants={users}
              currentUserName={userName}
              currentUserId={getSocket().id || ''}
              isHost={isOwner}
              newMessage={newMessage}
              onMessageChange={setNewMessage}
              onSendMessage={sendMessage}
              onMuteParticipant={handleMuteParticipant}
              hostMutedUsers={hostMutedUsers}
            />
          </div>
        )}
      </div>

      {/* Meeting Controls */}
      <MeetingControls
        isMuted={isMuted}
        isVideoOff={isVideoOff}
        onToggleMute={toggleMute}
        onToggleVideo={toggleVideo}
        onToggleChat={handleToggleChat}
        onToggleParticipants={handleToggleParticipants}
        onLeaveMeeting={handleLeaveMeeting}
      />

      {/* Incoming Call Modal */}
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