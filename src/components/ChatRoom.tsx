'use client';

import { useState, useEffect, useRef } from 'react';
import { getSocket, initializeSocket } from '@/lib/socket';
import { MultiPeerManager } from '@/lib/webrtc';
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
  const [isVideoOff, setIsVideoOff] = useState(true); // 🎥 Default: video OFF
  const [isLocalSpeaking, setIsLocalSpeaking] = useState(false);
  const [isRemoteSpeaking, setIsRemoteSpeaking] = useState(false);
  const [isRemoteMuted, setIsRemoteMuted] = useState(false);
  const [remoteMutedStatus, setRemoteMutedStatus] = useState<Map<string, boolean>>(new Map());
  const [remoteStreams, setRemoteStreams] = useState<Map<string, { stream: MediaStream; userName?: string }>>(new Map());
  const [micVolume, setMicVolume] = useState(100);
  const [speakerVolume, setSpeakerVolume] = useState(100);
  
  // Call list management
  const [callList, setCallList] = useState<string[]>([]); // List of users currently in call
  const [pendingInvitations, setPendingInvitations] = useState<Map<string, { userId: string; userName: string; timestamp: number }>>(new Map());
  const [joinRequests, setJoinRequests] = useState<Map<string, { userId: string; userName: string; timestamp: number }>>(new Map());
  const [showCallListPanel, setShowCallListPanel] = useState(true); // Start expanded by default
  const [incomingInvitation, setIncomingInvitation] = useState<{ fromUser: User; timestamp: number } | null>(null);
  const [incomingJoinRequest, setIncomingJoinRequest] = useState<{ fromUser: User; timestamp: number } | null>(null);

  // Toast notifications
  const [toasts, setToasts] = useState<Array<{ id: number; message: string; type?: 'info' | 'success' | 'error' | 'warning' }>>([]);
  const toastIdRef = useRef(0);
  const showToast = (message: string, type: 'info' | 'success' | 'error' | 'warning' = 'info', duration = 4000) => {
    const id = ++toastIdRef.current;
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, duration);
  };

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRefs = useRef<Map<string, HTMLVideoElement | null>>(new Map());
  const webrtcManager = useRef<MultiPeerManager | null>(null);
  const hasJoinedRoom = useRef(false); // Track if we've already joined to prevent duplicates
  const localAudioContextRef = useRef<AudioContext | null>(null);
  const remoteAudioContextRef = useRef<AudioContext | null>(null);
  const localAnalyserRef = useRef<AnalyserNode | null>(null);
  const remoteAnalyserRef = useRef<AnalyserNode | null>(null);
  const audioDetectionIntervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    console.log('🚀 Initializing ChatRoom...');
    console.log('📍 Room ID:', roomId);
    console.log('👤 User Name:', userName);
    console.log('🔑 Passcode:', passcode);
    console.log('⭐ Is Owner:', isOwner);

    const socket = getSocket();
    console.log('🔌 Socket initialized with ID:', socket.id);
    console.log('📡 Socket connected:', socket.connected);

    webrtcManager.current = new MultiPeerManager();

    // Relay per-target signals from peer manager to the server
    webrtcManager.current.onSignal(({ to, signalData }) => {
      console.log('📡 Emitting WebRTC signal to server -> target:', to, signalData);
      socket.emit('webrtc-signal', {
        roomId,
        targetUserId: to,
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

          // Check for JWT signature mismatch - clear old token and redirect to login
          if (error && error.details && (error.details.includes('invalid signature') || error.details.includes('jwt malformed'))) {
            console.log('🔄 Invalid JWT token detected - clearing and redirecting to login');
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            showToast('Your session has expired or is invalid. Please log in again.', 'error');
            window.location.href = '/login';
            return;
          }

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
      console.log('🔔 ===== ROOM-JOINED EVENT RECEIVED =====');
      console.log('✅ Successfully joined room:', roomId);
      console.log('👥 RAW Participants received:', users);
      console.log('💬 Messages received:', messages);
      
      // Add safety checks for undefined/null values
      const safeUsers = users || [];
      const safeMessages = messages || [];
      
      // Filter out current user from the participants list (to avoid duplicate display)
      // Use socketUserId from localStorage to identify the current user
      const persistentUserId = localStorage.getItem('socketUserId');
      console.log(`🔍 Current user identification:`, { persistentUserId, userName });
      
      const filteredUsers = safeUsers.filter((u: User) => {
        const match = u.name === userName || u.id === persistentUserId;
        console.log(`🔍 Checking participant ${u.name} (id: ${u.id}): match=${match}`);
        return !match;
      });
      
      console.log(`📊 Participant count after filtering: ${filteredUsers.length}`);
      console.log(`📊 Filtered Participant details:`, filteredUsers);
      console.log('� ===== END ROOM-JOINED EVENT =====');
      
      // Filter out any duplicate messages from initial load
      const uniqueMessages = safeMessages.filter((msg: Message, index: number, self: Message[]) => 
        index === self.findIndex(m => m.id === msg.id)
      );
      console.log('💬 Unique messages after filtering:', uniqueMessages);
      
      console.log('🔄 Setting users and messages...');
      setUsers(filteredUsers);
      setMessages(uniqueMessages);
      
      // Log current state after setting
      console.log('📊 Updated users state after setUsers:', filteredUsers);
      console.log('📊 Updated messages state after setMessages:', uniqueMessages);
      console.log('✅ Room join process completed');
      
      // 🎙️ AUTO-BROADCAST FOR HOST: If this user is the host, automatically start broadcasting
      if (isOwner) {
        console.log('🎙️ Host detected - auto-starting broadcast to room...');
        setTimeout(() => {
          // Auto-enable host broadcast with video
          autoStartHostBroadcast('video');
        }, 500); // Small delay to ensure WebRTC manager is ready
      }
    });

    // 🔥 CRITICAL FIX: Handle new user joining the room (consolidated handler)
    socket.on('user-joined', (data: { userName?: string; user: { id: string; name: string; isHost: boolean }; participantCount?: number }) => {
      console.log('👤 New user joined:', data.user);
      console.log('📊 Participant count:', data.participantCount);
      console.log('📌 Note: participants-updated will handle the participant list update');

      if (!data.user || !data.user.id || !data.user.name) {
        console.log('⚠️ Invalid user data received in user-joined event:', data.user);
        return;
      }

      // Don't update participant list here - wait for participants-updated event
      // This event is just for triggering UI feedback like toasts
      showToast(`${data.user.name} joined the room`, 'info');
    });

    socket.on('user-left', (userName: string) => {
      console.log('👤 User left:', userName);
      setUsers(prev => prev.filter(user => user.name !== userName));
    });

    // 📡 REAL-TIME UPDATE: Listen for participant list updates
    socket.on('participants-updated', ({ participants }: { participants: User[] }) => {
      console.log('� ===== PARTICIPANTS-UPDATED EVENT RECEIVED =====');
      console.log('�📡 RAW Participants from server:', participants);
      console.log('📡 Raw length:', participants?.length);
      
      // Filter out current user from the participants list (to avoid duplicate display)
      // Use socketUserId from localStorage to identify the current user
      const persistentUserId = localStorage.getItem('socketUserId');
      console.log(`🔍 Current user identification:`, { persistentUserId, userName });
      
      const filteredParticipants = participants.filter((p: User) => {
        const match = p.name === userName || p.id === persistentUserId;
        console.log(`� Checking participant ${p.name} (id: ${p.id}): match=${match}`);
        return !match;
      });
      
      console.log('📡 FILTERED Participants (current user excluded):', filteredParticipants);
      console.log('📡 Filtered length:', filteredParticipants.length);
      console.log('🔔 ===== END PARTICIPANTS-UPDATED EVENT =====');
      
      setUsers(filteredParticipants);
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
      showToast('Call was rejected', 'warning');
    });

    socket.on('call-ended', () => {
      // Don't emit back to server - we're receiving the end notification
      endCall(false);
    });

    socket.on('end-call', ({ fromUserId }: { fromUserId: string }) => {
      console.log('📴 Received end-call notification from:', fromUserId);
      // End the call on this side without re-emitting to server
      endCall(false, fromUserId);
    });

    socket.on('webrtc-signal', async ({ signalData, fromUserId }) => {
      console.log('📡 Received WebRTC signal from:', fromUserId);
      console.log('📊 Current call state:', callState);

      if (webrtcManager.current) {
        // MultiPeerManager will create peers for offers or queue candidates as needed
        webrtcManager.current.signal(fromUserId, signalData);
      }
    });

    socket.on('mute-status', ({ isMuted, fromUserId }: { isMuted: boolean; fromUserId?: string }) => {
      console.log('🔇 Received mute status from remote user:', fromUserId, isMuted ? 'MUTED' : 'UNMUTED');
      
      // If fromUserId is provided, update per-user mute status
      if (fromUserId) {
        setRemoteMutedStatus(prev => {
          const updated = new Map(prev);
          updated.set(fromUserId, isMuted);
          return updated;
        });
      }
      
      // Also keep the global state for backward compatibility
      setIsRemoteMuted(isMuted);
    });

    // Call list events
    socket.on('invite-to-call', ({ fromUser }: { fromUser: User }) => {
      console.log('📞 Received call invitation from:', fromUser.name);
      setIncomingInvitation({ fromUser, timestamp: Date.now() });
    });

    socket.on('request-join-call', ({ fromUser }: { fromUser: User }) => {
      console.log('🙋 Received join request from:', fromUser.name);
      if (isOwner) {
        setIncomingJoinRequest({ fromUser, timestamp: Date.now() });
      }
    });

    socket.on('invitation-approved', ({ hostName }: { hostName: string }) => {
      console.log('✅ Invitation approved by:', hostName);
      showToast(`${hostName} approved your join request!`, 'success');
    });

    socket.on('invitation-rejected', ({ hostName }: { hostName: string }) => {
      console.log('❌ Invitation rejected by:', hostName);
      showToast(`${hostName} rejected your join request.`, 'warning');
    });

    socket.on('call-list-updated', ({ callList: updatedList }: { callList: string[] }) => {
      console.log('📋 Call list updated:', updatedList);
      setCallList(updatedList);
    });

    // Invites feedback
    socket.on('invite-sent', ({ targetUserId, targetUserName }: { targetUserId?: string; targetUserName?: string }) => {
      console.log('📨 Invite sent ack for', targetUserId, targetUserName);
      showToast(`Invitation sent to ${targetUserName || targetUserId}`, 'success');
    });

    socket.on('invite-failed', ({ reason, targetUserId, targetUserName, details }: { reason?: string; targetUserId?: string; targetUserName?: string; details?: string }) => {
      console.warn('❌ Invite failed:', reason, targetUserId, targetUserName, details);
      showToast(`Failed to invite ${targetUserName || targetUserId}: ${reason || 'unknown'}`, 'error');

      // Remove pending invitation if exists
      if (targetUserId) {
        setPendingInvitations(prev => {
          const updated = new Map(prev);
          updated.delete(targetUserId);
          return updated;
        });
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
      socket.off('participants-updated');
      socket.off('new-message');
      socket.off('incoming-call');
      socket.off('call-accepted');
      socket.off('call-rejected');
      socket.off('call-ended');
      socket.off('webrtc-signal');
      
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

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // Start a direct call to a single participant
  const startDirectCall = async (targetUserId: string, callType: 'voice' | 'video') => {
    try {
      if (!webrtcManager.current) return;
      const stream = await webrtcManager.current.createLocalStream(callType === 'video');
      if (localVideoRef.current) localVideoRef.current.srcObject = stream;
      setupAudioDetection(stream, true);
      setCallState({ isCalling: true, isInCall: false, callType, localStream: stream });

      webrtcManager.current.onRemoteStream((remoteId, remoteStream) => {
        console.log('📺 Received remote stream from', remoteId);
        // Add to remoteStreams map by remoteId
        setRemoteStreams(prev => {
          const updated = new Map(prev);
          updated.set(remoteId, { stream: remoteStream, userName: remoteId });
          return updated;
        });
        // Attach to video element for this remoteId
        const videoRef = remoteVideoRefs.current.get(remoteId);
        if (videoRef) {
          videoRef.srcObject = remoteStream;
          videoRef.play().catch(() => {});
        }
        setupAudioDetection(remoteStream, false);
        startAudioDetection();
        setCallState(prev => ({ ...prev, isCalling: false, isInCall: true }));
      });

      const socket = getSocket();
      socket.emit('start-call', { roomId, callType, targetUserId });
      await webrtcManager.current.initiateCallTo(targetUserId, true);
    } catch (e: any) {
      console.error('Error starting direct call', e);
      showToast(e?.message || 'Failed to start direct call', 'error');
    }
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

  // Audio activity detection
  const setupAudioDetection = (stream: MediaStream, isLocal: boolean) => {
    try {
      const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
      const audioContext = new AudioContext();
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 2048;
      analyser.smoothingTimeConstant = 0.8;

      const source = audioContext.createMediaStreamSource(stream);
      source.connect(analyser);

      if (isLocal) {
        localAudioContextRef.current = audioContext;
        localAnalyserRef.current = analyser;
      } else {
        remoteAudioContextRef.current = audioContext;
        remoteAnalyserRef.current = analyser;
      }

      console.log(`🎵 Audio detection setup for ${isLocal ? 'local' : 'remote'} stream`);
    } catch (error) {
      console.error(`Error setting up audio detection for ${isLocal ? 'local' : 'remote'}:`, error);
    }
  };

  const detectAudioActivity = () => {
    const bufferLength = 2048;
    const dataArray = new Uint8Array(bufferLength);

    // Detect local audio activity
    if (localAnalyserRef.current) {
      localAnalyserRef.current.getByteTimeDomainData(dataArray);
      let sum = 0;
      for (let i = 0; i < bufferLength; i++) {
        const normalized = (dataArray[i] - 128) / 128;
        sum += normalized * normalized;
      }
      const rms = Math.sqrt(sum / bufferLength);
      const isSpeaking = rms > 0.01; // Threshold for speech detection
      setIsLocalSpeaking(isSpeaking);
    }

    // Detect remote audio activity
    if (remoteAnalyserRef.current) {
      remoteAnalyserRef.current.getByteTimeDomainData(dataArray);
      let sum = 0;
      for (let i = 0; i < bufferLength; i++) {
        const normalized = (dataArray[i] - 128) / 128;
        sum += normalized * normalized;
      }
      const rms = Math.sqrt(sum / bufferLength);
      const isSpeaking = rms > 0.01;
      setIsRemoteSpeaking(isSpeaking);
    }
  };

  const startAudioDetection = () => {
    if (audioDetectionIntervalRef.current) {
      clearInterval(audioDetectionIntervalRef.current);
    }
    audioDetectionIntervalRef.current = setInterval(detectAudioActivity, 100); // Check every 100ms
    console.log('🎵 Started audio activity detection');
  };

  const stopAudioDetection = () => {
    if (audioDetectionIntervalRef.current) {
      clearInterval(audioDetectionIntervalRef.current);
      audioDetectionIntervalRef.current = null;
    }
    if (localAudioContextRef.current) {
      localAudioContextRef.current.close();
      localAudioContextRef.current = null;
    }
    if (remoteAudioContextRef.current) {
      remoteAudioContextRef.current.close();
      remoteAudioContextRef.current = null;
    }
    setIsLocalSpeaking(false);
    setIsRemoteSpeaking(false);
    console.log('🎵 Stopped audio activity detection');
  };

  // 🎙️ AUTO-BROADCAST FOR HOST: Start broadcasting to entire room without explicit invite
  const autoStartHostBroadcast = async (broadcastType: 'voice' | 'video') => {
    try {
      if (!webrtcManager.current) {
        console.error('❌ WebRTC manager not initialized');
        return;
      }

      console.log('🎙️ Host starting auto-broadcast with type:', broadcastType);

      // Create local media stream - video OFF by default (user must toggle on manually)
      const stream = await webrtcManager.current.createLocalStream(false);
      if (localVideoRef.current) localVideoRef.current.srcObject = stream;
      setupAudioDetection(stream, true);

      setCallState({
        isCalling: false,
        isInCall: true,
        callType: broadcastType,
        localStream: stream
      });

      // Handle remote streams from participants joining the host's broadcast
      webrtcManager.current.onRemoteStream((remoteId, remoteStream) => {
        console.log('📺 Received remote stream from participant:', remoteId);
        setRemoteStreams(prev => {
          const updated = new Map(prev);
          updated.set(remoteId, { stream: remoteStream, userName: remoteId });
          return updated;
        });
        const videoRef = remoteVideoRefs.current.get(remoteId);
        if (videoRef) {
          videoRef.srcObject = remoteStream;
          videoRef.play().catch((err: any) => console.warn('Auto-play blocked', err));
        }
        setupAudioDetection(remoteStream, false);
        startAudioDetection();
      });

      // Emit to server that host is broadcasting
      const socket = getSocket();
      socket.emit('start-broadcast', {
        roomId,
        broadcastType,
        userName
      });

      console.log('✅ Host auto-broadcast started');
      showToast(`🎙️ Broadcasting ${broadcastType} to room`, 'success');
    } catch (error: any) {
      console.error('❌ Failed to start host broadcast:', error.message);
      let errorMsg = 'Failed to start broadcast: ' + error.message;
      if (error.name === 'NotAllowedError') {
        errorMsg = '🔒 Camera/mic permission denied. Please allow access in browser settings.';
      } else if (error.name === 'NotFoundError') {
        errorMsg = '📷 No camera or microphone found. Check your device settings.';
      } else if (error.message?.includes('Media unavailable')) {
        errorMsg = '⚠️ Media unavailable on your device. Cannot start broadcast.';
      }
      showToast(errorMsg, 'error');
    }
  };

  const startCall = async (callType: 'voice' | 'video') => {
    try {
      if (!webrtcManager.current) return;

      const stream = await webrtcManager.current.createLocalStream(callType === 'video');
      if (localVideoRef.current) localVideoRef.current.srcObject = stream;
      setupAudioDetection(stream, true);

      setCallState({ isCalling: true, isInCall: false, callType, localStream: stream });

      // Ensure remote streams are handled per-remote with grid support
      webrtcManager.current.onRemoteStream((remoteId, remoteStream) => {
        console.log('📺 Received remote stream from', remoteId);
        // Add to remoteStreams map by remoteId
        setRemoteStreams(prev => {
          const updated = new Map(prev);
          updated.set(remoteId, { stream: remoteStream, userName: remoteId });
          return updated;
        });
        // Attach to video element for this remoteId
        const videoRef = remoteVideoRefs.current.get(remoteId);
        if (videoRef) {
          videoRef.srcObject = remoteStream;
          videoRef.play().catch((err: any) => console.warn('Auto-play blocked', err));
        }
        setupAudioDetection(remoteStream, false);
        startAudioDetection();
        setCallState(prev => ({ ...prev, isCalling: false, isInCall: true, localStream: prev.localStream || stream }));
      });

      const socket = getSocket();
      const otherUsers = users.filter(u => u.id !== socket.id);
      if (otherUsers.length === 0) {
        socket.emit('start-call', { roomId, callType });
        // no targets known, nothing else to do
        return;
      }

      // Start outgoing call to each participant
      for (const u of otherUsers) {
        socket.emit('start-call', { roomId, callType, targetUserId: u.id });
        await webrtcManager.current.initiateCallTo(u.id, true);
      }
    } catch (error: any) {
      console.error('Error starting call:', error);
      showToast(error?.message || 'Failed to start call. Please check camera/microphone permissions.', 'error');
    }
  };

  const acceptCall = async () => {
    if (!incomingCall || !webrtcManager.current) return;
    try {
      console.log('📞 Accepting call from:', incomingCall.fromUser.name);
      const stream = await webrtcManager.current.createLocalStream(incomingCall.callType === 'video');
      if (localVideoRef.current) localVideoRef.current.srcObject = stream;
      setupAudioDetection(stream, true);
      setCallState({ isCalling: false, isInCall: true, callType: incomingCall.callType, localStream: stream });

      // Initialize a peer for this caller (non-initiator). Any queued offer/candidates will be applied by the manager.
      await webrtcManager.current.initiateCallTo(incomingCall.fromUser.id, false);

      const socket = getSocket();
      socket.emit('accept-call', { roomId, targetUserId: incomingCall.fromUser.id });

      setIncomingCall(null);
      console.log('✅ Call accepted successfully');
    } catch (error: any) {
      console.error('Error accepting call:', error);
      showToast(error?.message || 'Failed to accept call.', 'error');
      setIncomingCall(null);
    }
  };

  const rejectCall = () => {
    if (!incomingCall) return;

    const socket = getSocket();
    socket.emit('call-rejected', { roomId, targetUserId: incomingCall.fromUser.id });
    setIncomingCall(null);
    console.log('🚫 Call rejected');
  };

  // Call list functions
  const inviteUserToCall = (targetUserId: string, targetUserName: string) => {
    console.log('📞 Inviting user to call:', targetUserName);
    const socket = getSocket();
    socket.emit('invite-to-call', { roomId, targetUserId, targetUserName });
    
    // Add to pending invitations
    setPendingInvitations(prev => {
      const updated = new Map(prev);
      updated.set(targetUserId, { userId: targetUserId, userName: targetUserName, timestamp: Date.now() });
      return updated;
    });
  };

  const requestJoinCall = () => {
    console.log('🙋 Requesting to join call');
    const socket = getSocket();
    const userId = socket.id || '';
    socket.emit('request-join-call', { roomId, userId, userName });
  };

  const approveJoinRequest = async (userId: string, userName: string) => {
    console.log('✅ Approving join request from:', userName);
    const socket = getSocket();
    socket.emit('approve-join-request', { roomId, userId, userName });
    
    // Add to call list
    setCallList(prev => [...prev, userId]);
    
    // Automatically invite them into a call (or start call with them)
    console.log('📞 Auto-starting call with approved requester:', userName);
    try {
      await startDirectCall(userId, 'video');
      showToast(`Call started with ${userName}`, 'success');
    } catch (err: any) {
      console.error('❌ Failed to start call:', err.message);
      let errorMsg = 'Failed to start call: ' + err.message;
      if (err.name === 'NotAllowedError') {
        errorMsg = '🔒 Camera/mic permission denied. Please allow access in browser settings.';
      } else if (err.name === 'NotFoundError') {
        errorMsg = '📷 No camera or microphone found. Check your device settings.';
      } else if (err.message?.includes('Media unavailable')) {
        errorMsg = '⚠️ Media unavailable on your device. Cannot start call.';
      }
      showToast(errorMsg, 'error');
    }
    
    // Remove from join requests
    setJoinRequests(prev => {
      const updated = new Map(prev);
      updated.delete(userId);
      return updated;
    });
    
    setIncomingJoinRequest(null);
  };

  const rejectJoinRequest = (userId: string, userName: string) => {
    console.log('❌ Rejecting join request from:', userName);
    const socket = getSocket();
    socket.emit('reject-join-request', { roomId, userId, userName });
    
    // Remove from join requests
    setJoinRequests(prev => {
      const updated = new Map(prev);
      updated.delete(userId);
      return updated;
    });
    
    setIncomingJoinRequest(null);
  };

  const acceptInvitation = async () => {
    if (!incomingInvitation) return;
    console.log('✅ Accepted invitation from:', incomingInvitation.fromUser.name);
    const socket = getSocket();
    const userId = socket.id || '';
    socket.emit('accept-invitation', { roomId, userId, userName });
    
    // Add to call list
    setCallList(prev => [...prev, userId]);
    
    // Automatically start a video call with the inviter
    console.log('📞 Auto-starting call with inviter:', incomingInvitation.fromUser.name);
    try {
      await startDirectCall(incomingInvitation.fromUser.id, 'video');
      showToast(`Call started with ${incomingInvitation.fromUser.name}`, 'success');
    } catch (err: any) {
      console.error('❌ Failed to start call:', err.message);
      let errorMsg = 'Failed to start call: ' + err.message;
      if (err.name === 'NotAllowedError') {
        errorMsg = '🔒 Camera/mic permission denied. Please allow access in browser settings.';
      } else if (err.name === 'NotFoundError') {
        errorMsg = '📷 No camera or microphone found. Check your device settings.';
      } else if (err.message?.includes('Media unavailable')) {
        errorMsg = '⚠️ Media unavailable on your device. Cannot start call.';
      }
      showToast(errorMsg, 'error');
    }
    
    setIncomingInvitation(null);
  };

  const rejectInvitation = () => {
    if (!incomingInvitation) return;
    console.log('❌ Rejected invitation from:', incomingInvitation.fromUser.name);
    const socket = getSocket();
    const userId = socket.id || '';
    socket.emit('reject-invitation', { roomId, userId, userName });
    setIncomingInvitation(null);
  };

  const endCall = (emitToServer: boolean = true, targetUserId?: string) => {
    // Stop audio detection
    stopAudioDetection();

    if (webrtcManager.current) {
      if (targetUserId) {
        // End call with a specific peer
        webrtcManager.current.cleanupPeer(targetUserId);
      } else {
        // End all calls
        webrtcManager.current.cleanupAll();
      }
    }

    if (localVideoRef.current) {
      localVideoRef.current.srcObject = null;
    }

    // Clear all remote video refs and streams (if not targeting a specific peer)
    if (!targetUserId) {
      remoteVideoRefs.current.forEach((videoRef) => {
        if (videoRef) {
          videoRef.srcObject = null;
        }
      });
      remoteVideoRefs.current.clear();
      setRemoteStreams(new Map());
    } else {
      // Remove only the specific remote stream
      setRemoteStreams(prev => {
        const updated = new Map(prev);
        updated.delete(targetUserId);
        return updated;
      });
      remoteVideoRefs.current.delete(targetUserId);
    }

    // Only reset call state if ending all calls, not a specific peer
    if (!targetUserId) {
      setCallState({
        isCalling: false,
        isInCall: false,
        callType: null,
      });

      // Reset audio/video controls
      setIsMuted(false);
      setIsVideoOff(true); // 🎥 Default: video OFF after call ends
      setIsRemoteMuted(false);
    }

  console.log('📴 Call ended' + (targetUserId ? ` with ${targetUserId}` : ''));

    // Only emit to server if we're the one ending the call, not when receiving end-call event
    if (emitToServer) {
      const socket = getSocket();
      socket.emit('end-call', { roomId, targetUserId });
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

    // Emit muted status to other users in the room
    const socket = getSocket();
    socket.emit('mute-status', { roomId, isMuted: newMutedState });
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
      console.warn('⚠️ No video tracks in stream (audio-only call)');
      showToast('🎥 Video not available - using audio only', 'info');
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

  const handleMicVolumeChange = (value: number) => {
    setMicVolume(value);
    console.log('🎤 Microphone volume changed to:', value);
    
    // Apply volume to local audio tracks if available
    let localStream: MediaStream | null = null;
    if (callState.localStream) {
      localStream = callState.localStream;
    } else if (webrtcManager.current) {
      localStream = webrtcManager.current.getLocalStream();
    } else if (localVideoRef.current && localVideoRef.current.srcObject) {
      localStream = localVideoRef.current.srcObject as MediaStream;
    }

    if (localStream) {
      const audioTracks = localStream.getAudioTracks();
      audioTracks.forEach(track => {
        // Note: Web Audio API doesn't allow direct volume control on MediaStreamTrack
        // But we can use it for UI feedback and send volume info to peers if needed
        console.log(`🎤 Track volume set to: ${value}%`);
      });
    }
  };

  const handleSpeakerVolumeChange = (value: number) => {
    setSpeakerVolume(value);
    console.log('🔊 Speaker volume changed to:', value);
    
    // Apply volume to all remote video elements
    remoteVideoRefs.current.forEach((videoRef) => {
      if (videoRef) {
        videoRef.volume = value / 100;
        console.log(`🔊 Remote video volume set to: ${value}%`);
      }
    });

    // Also apply to local video element if it has audio
    if (localVideoRef.current) {
      localVideoRef.current.volume = value / 100;
    }
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
                      showToast(`${t('chatRoom.roomId')}: ${roomId}`, 'info');
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
                      showToast(`${t('chatRoom.passcode')}: ${passcode}`, 'info');
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
                      showToast(`${t('chatRoom.shareUrl')}: ${shareUrl}`, 'info');
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
          
          {/* Note: 1-to-1 voice/video call buttons removed. See ChatRoom.old.tsx for legacy functionality. */}
          {/* Group calling is now managed via the call list system (invites and requests) */}
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
            <div className="d-flex justify-content-between align-items-center mb-3">
              <h6 className="mb-0">
                <i className="bi bi-people-fill me-2"></i>
                {t('chatRoom.participants')}
              </h6>
              <button
                className="btn btn-sm btn-outline-info"
                onClick={() => setShowCallListPanel(!showCallListPanel)}
                title={showCallListPanel ? 'Hide' : 'Show'}
              >
                <i className={`bi bi-chevron-${showCallListPanel ? 'up' : 'down'}`}></i>
              </button>
            </div>

            {showCallListPanel && (
              <div className="list-group">
                {/* Current user (owner) - Single entry */}
                <div className="list-group-item bg-transparent text-white border-secondary">
                  <i className="bi bi-person-circle me-2"></i>
                  {userName}
                  <span className="badge bg-primary ms-2">{t('chatRoom.you')}</span>
                  {isOwner && <span className="badge bg-warning ms-1">{t('chatRoom.host')}</span>}
                </div>

                {/* Other users with call list actions */}
                {users && users.map((user, index) => {
                  const uniqueKey = user?.id || user?.name || `user-${index}`;
                  const isInCallList = callList.includes(user.id);
                  
                  return (
                    <div
                      key={uniqueKey}
                      className="list-group-item bg-transparent text-white border-secondary d-flex justify-content-between align-items-center"
                    >
                      <div>
                        <i className="bi bi-person-circle me-2"></i>
                        {user?.name || 'Unknown User'}
                        {user?.isHost && <span className="badge bg-warning ms-2">{t('chatRoom.host')}</span>}
                        {isInCallList && <span className="badge bg-success ms-2"><i className="bi bi-telephone-fill"></i> In Call</span>}
                      </div>
                      <div className="d-flex gap-2">
                        {user.id !== getSocket().id && (
                          <>
                            {isOwner && !isInCallList ? (
                              // Host can invite
                              <button
                                className="btn btn-sm btn-outline-success"
                                title="Invite to call"
                                onClick={() => inviteUserToCall(user.id, user.name)}
                              >
                                <i className="bi bi-telephone-plus-fill"></i>
                              </button>
                            ) : !isOwner && !isInCallList ? (
                              // Participant can request to join (anytime, not blocked by isInCall state)
                              <button
                                className="btn btn-sm btn-outline-info"
                                title="Request to join call"
                                onClick={() => requestJoinCall()}
                              >
                                <i className="bi bi-hand-thumbs-up"></i>
                              </button>
                            ) : null}
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {(callState.isInCall || callState.isCalling) && (
            <div className="glass-morphism p-3">
              <h6 className="mb-3">
                <i className="bi bi-camera-video me-2"></i>
                {callState.isCalling ? t('chatRoom.calling') : t('chatRoom.inCall')}
              </h6>

              <div className="video-container mb-2 position-relative" style={{ height: '150px' }}>
                <video
                  ref={localVideoRef}
                  autoPlay
                  muted
                  playsInline
                  className="w-100 h-100"
                  style={{
                    border: isLocalSpeaking ? '3px solid #00ff00' : '1px solid #666',
                    borderRadius: '8px',
                    transition: 'border 0.2s'
                  }}
                />
                {isMuted && (
                  <div className="position-absolute top-0 end-0 p-2">
                    <span className="badge bg-danger">
                      <i className="bi bi-mic-mute-fill"></i> Muted
                    </span>
                  </div>
                )}
                {isLocalSpeaking && !isMuted && (
                  <div className="position-absolute top-0 start-0 p-2">
                    <span className="badge bg-success">
                      <i className="bi bi-soundwave"></i> Speaking
                    </span>
                  </div>
                )}
                <div className="position-absolute bottom-0 start-0 p-2">
                  <small className="badge bg-primary">You</small>
                </div>
              </div>

              {callState.isInCall && (
                <div className="mb-3">
                  <h6 className="mb-2">Remote Participants</h6>
                  <div 
                    style={{
                      display: 'grid',
                      gridTemplateColumns: remoteStreams.size === 0 ? '1fr' : remoteStreams.size === 1 ? '1fr' : remoteStreams.size === 2 ? '1fr 1fr' : '1fr 1fr 1fr',
                      gap: '10px',
                      marginBottom: '10px'
                    }}
                  >
                    {Array.from(remoteStreams.entries()).map(([remoteId, { stream, userName }]) => (
                      <div
                        key={remoteId}
                        className="video-container position-relative"
                        style={{ height: '150px' }}
                      >
                        <video
                          ref={(el) => {
                            if (el) {
                              remoteVideoRefs.current.set(remoteId, el);
                            }
                          }}
                          autoPlay
                          playsInline
                          className="w-100 h-100"
                          style={{
                            border: isRemoteSpeaking ? '3px solid #00ff00' : '1px solid #666',
                            borderRadius: '8px',
                            transition: 'border 0.2s',
                            objectFit: 'cover'
                          }}
                        />
                        {/* Per-user mute indicator */}
                        {remoteMutedStatus.get(remoteId) && (
                          <div className="position-absolute top-0 end-0 p-2">
                            <span className="badge bg-danger">
                              <i className="bi bi-mic-mute-fill"></i> Muted
                            </span>
                          </div>
                        )}
                        {isRemoteSpeaking && !remoteMutedStatus.get(remoteId) && (
                          <div className="position-absolute top-0 start-0 p-2">
                            <span className="badge bg-success">
                              <i className="bi bi-soundwave"></i> Speaking
                            </span>
                          </div>
                        )}
                        <div className="position-absolute bottom-0 start-0 p-2">
                          <small className="badge bg-secondary">{userName}</small>
                        </div>
                      </div>
                    ))}
                  </div>
                  {remoteStreams.size === 0 && (
                    <div className="text-muted text-center py-3">
                      <i className="bi bi-camera-off me-2"></i>
                      Waiting for remote participants...
                    </div>
                  )}
                </div>
              )}

              {/* Audio/Video Controls - Show during calling and in call */}
              {(callState.isCalling || callState.isInCall) && (
                <div className="d-flex flex-column gap-2">
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
                        disabled={!callState.localStream || callState.localStream.getVideoTracks().length === 0}
                      >
                        <i className={`bi ${isVideoOff ? 'bi-camera-video-off-fill' : 'bi-camera-video-fill'}`}></i>
                      </button>
                    )}

                    <button
                      className="btn btn-danger ms-2"
                      onClick={() => endCall()}
                      title="End call"
                    >
                      <i className="bi bi-telephone-x-fill"></i> End Call
                    </button>
                  </div>

                  {/* Volume Controls */}
                  <div className="border-top border-secondary pt-2">
                    <div className="mb-2">
                      <label className="form-label small mb-1">
                        <i className={`bi ${isMuted ? 'bi-mic-mute-fill text-danger' : isLocalSpeaking ? 'bi-mic-fill text-success' : 'bi-mic-fill text-secondary'}`} style={{ transition: 'color 0.2s' }}></i>
                        <span className="ms-2">
                          Mic Volume: {micVolume}%
                          {isLocalSpeaking && !isMuted && <span className="badge bg-success ms-2 ms-2"><i className="bi bi-soundwave"></i> Speaking</span>}
                          {isMuted && <span className="badge bg-danger ms-2"><i className="bi bi-mic-mute-fill"></i> Muted</span>}
                        </span>
                      </label>
                      <input
                        type="range"
                        className="form-range"
                        min="0"
                        max="100"
                        value={micVolume}
                        onChange={(e) => handleMicVolumeChange(Number(e.target.value))}
                        style={{
                          accentColor: isMuted ? '#dc3545' : isLocalSpeaking ? '#198754' : '#6c757d'
                        }}
                      />
                    </div>
                    <div>
                      <label className="form-label small mb-1">
                        <i className={`bi bi-speaker-fill text-info`}></i>
                        <span className="ms-2">
                          Speaker Volume: {speakerVolume}%
                          {isRemoteSpeaking && !isRemoteMuted && <span className="badge bg-info ms-2"><i className="bi bi-soundwave"></i> Remote Speaking</span>}
                          {isRemoteMuted && <span className="badge bg-danger ms-2"><i className="bi bi-mic-mute-fill"></i> Remote Muted</span>}
                        </span>
                      </label>
                      <input
                        type="range"
                        className="form-range"
                        min="0"
                        max="100"
                        value={speakerVolume}
                        onChange={(e) => handleSpeakerVolumeChange(Number(e.target.value))}
                        style={{
                          accentColor: isRemoteMuted ? '#dc3545' : isRemoteSpeaking ? '#0dcaf0' : '#6c757d'
                        }}
                      />
                    </div>
                  </div>
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

      {/* Incoming call invitation modal */}
      {incomingInvitation && (
        <div className="position-fixed top-50 start-50 translate-middle glass-morphism p-4" style={{ zIndex: 1001 }}>
          <h6 className="mb-3">
            <i className="bi bi-telephone-plus-fill me-2"></i>
            Call Invitation
          </h6>
          <p className="mb-3">{incomingInvitation.fromUser.name} invited you to join the call</p>
          <div className="d-flex gap-2">
            <button
              className="btn btn-success"
              onClick={acceptInvitation}
            >
              <i className="bi bi-check-circle me-1"></i>
              Accept
            </button>
            <button
              className="btn btn-danger"
              onClick={rejectInvitation}
            >
              <i className="bi bi-x-circle me-1"></i>
              Reject
            </button>
          </div>
        </div>
      )}

      {/* Join request modal for host */}
      {incomingJoinRequest && isOwner && (
        <div className="position-fixed top-50 start-50 translate-middle glass-morphism p-4" style={{ zIndex: 1001 }}>
          <h6 className="mb-3">
            <i className="bi bi-hand-thumbs-up me-2"></i>
            Join Request
          </h6>
          <p className="mb-3">{incomingJoinRequest.fromUser.name} requested to join the call</p>
          <div className="d-flex gap-2">
            <button
              className="btn btn-success"
              onClick={() => approveJoinRequest(incomingJoinRequest.fromUser.id, incomingJoinRequest.fromUser.name)}
            >
              <i className="bi bi-check-circle me-1"></i>
              Approve
            </button>
            <button
              className="btn btn-danger"
              onClick={() => rejectJoinRequest(incomingJoinRequest.fromUser.id, incomingJoinRequest.fromUser.name)}
            >
              <i className="bi bi-x-circle me-1"></i>
              Reject
            </button>
          </div>
        </div>
      )}
      {/* Toast container */}
      <div style={{ position: 'fixed', top: 20, right: 20, zIndex: 2000 }}>
        {toasts.map(toast => (
          <div
            key={toast.id}
            onClick={() => setToasts(prev => prev.filter(t => t.id !== toast.id))}
            style={{
              marginBottom: '8px',
              padding: '10px 14px',
              minWidth: '220px',
              borderRadius: '8px',
              color: '#fff',
              boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
              cursor: 'pointer',
              background: toast.type === 'success' ? '#198754' : toast.type === 'error' ? '#dc3545' : toast.type === 'warning' ? '#ffc107' : '#0d6efd'
            }}
          >
            <div style={{ fontSize: '14px', fontWeight: 600 }}>{toast.type?.toUpperCase()}</div>
            <div style={{ fontSize: '13px', marginTop: 6 }}>{toast.message}</div>
          </div>
        ))}
      </div>
    </div>
  );
}