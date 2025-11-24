'use client';

import { useState, useEffect, useRef } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import MeetingHeader from './meeting/MeetingHeader';
import VideoGallery from './meeting/VideoGallery';
import MeetingControls from './meeting/MeetingControls';
import SidePanel from './meeting/SidePanel';
import { useSocketConnection } from '@/hooks/useSocketConnection';
import { useChat } from '@/hooks/useChat';
import { useWebRTC } from '@/hooks/useWebRTC';
import { useRoomFeatures } from '@/hooks/useRoomFeatures';
import { detectSpeaking } from '@/lib/audioDetection';
import { VideoStream } from '@/types';

interface ChatRoomProps {
  roomId: string;
  userName: string;
  passcode: string;
  isOwner?: boolean;
}

export default function ChatRoom({ roomId, userName, passcode, isOwner = false }: ChatRoomProps) {
  const { t } = useLanguage();
  const [newMessage, setNewMessage] = useState('');
  const [showChat, setShowChat] = useState(true);
  const [showParticipants, setShowParticipants] = useState(false);
  const [localIsSpeaking, setLocalIsSpeaking] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Hooks
  const { socket, isConnected, isAuthenticated, hasJoined } = useSocketConnection({ roomId, userName, passcode });
  const { messages, users, sendMessage } = useChat(socket, roomId, userName);
  const {
    callState, incomingCall, localVideoRef, remoteVideoRef, remoteStreams,
    startCall, acceptCall, rejectCall, endCall, webrtcManager
  } = useWebRTC(socket, roomId);
  const {
    isMuted, setIsMuted, isVideoOff, setIsVideoOff, hostMutedUsers, isHostMuted,
    speakingParticipants, raisedHands, activeReactions, screenSharingUser,
    waitingParticipants, connectionQuality, setConnectionQuality
  } = useRoomFeatures(socket, roomId);

  // Scroll to bottom on new message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Speaking detection
  useEffect(() => {
    if (!callState.localStream) {
      setLocalIsSpeaking(false);
      return;
    }
    const cleanup = detectSpeaking(callState.localStream, (isSpeaking) => {
      setLocalIsSpeaking(isSpeaking);
    });
    return cleanup;
  }, [callState.localStream]);

  // Handle local mute/video toggle
  useEffect(() => {
    if (callState.localStream) {
      callState.localStream.getAudioTracks().forEach(track => track.enabled = !isMuted);
      callState.localStream.getVideoTracks().forEach(track => track.enabled = !isVideoOff);
    }
  }, [isMuted, isVideoOff, callState.localStream]);

  // Phase 2: Connection Quality Monitoring
  useEffect(() => {
    if (!webrtcManager.current) return;
    webrtcManager.current.onQualityMetrics((remoteId, metrics) => {
      const quality = webrtcManager.current?.getConnectionQuality(remoteId);
      if (quality) {
        setConnectionQuality(prev => {
          const newMap = new Map(prev);
          newMap.set(remoteId, quality);
          return newMap;
        });
      }
    });
  }, [webrtcManager.current]);

  const handleSendMessage = () => {
    sendMessage(newMessage);
    setNewMessage('');
  };

  const handleMuteParticipant = (targetUserId: string) => {
    socket?.emit('host-mute-participant', { roomId, targetUserId, reason: 'Host muted you' });
  };

  const handleRemoveParticipant = (targetUserId: string) => {
    socket?.emit('host-remove-participant', { roomId, targetUserId, reason: 'Host removed you' });
  };

  return (
    <div className="flex flex-col h-screen bg-gray-900 text-white">
      <MeetingHeader
        roomId={roomId}
        participantCount={users.length}
        passcode={passcode}
        isHost={isOwner}
        onLeave={() => {
          endCall();
          window.location.href = '/';
        }}
      />

      <div className="flex flex-1 overflow-hidden">
        <div className="flex-1 flex flex-col relative">
          <VideoGallery
            localStream={callState.localStream || null}
            localUserName={userName}
            localIsMuted={isMuted}
            localIsVideoOff={isVideoOff}
            localIsSpeaking={localIsSpeaking}
            participants={users.map(u => ({
              ...u,
              isMuted: hostMutedUsers.has(u.id),
              isSpeaking: speakingParticipants.has(u.id),
              isVideoOff: false // TODO: Track this
            }))}
            remoteStreams={new Map(Array.from(remoteStreams.entries()).map(([id, stream]) => [id, { stream }]))}
            isHost={isOwner}
          />

          {/* Incoming Call Modal */}
          {incomingCall && (
            <div className="absolute top-4 right-4 bg-gray-800 p-4 rounded-lg shadow-lg z-50 animate-bounce">
              <p className="mb-2">{incomingCall.fromUser.name} is calling...</p>
              <div className="flex gap-2">
                <button onClick={acceptCall} className="bg-green-500 px-4 py-2 rounded">Accept</button>
                <button onClick={rejectCall} className="bg-red-500 px-4 py-2 rounded">Reject</button>
              </div>
            </div>
          )}

          {/* Call Controls if not in call */}
          {!callState.isInCall && !callState.isCalling && (
            <div className="absolute bottom-24 left-1/2 transform -translate-x-1/2 flex gap-4 z-50">
              <button onClick={() => startCall('voice')} className="bg-blue-600 p-4 rounded-full shadow-lg hover:bg-blue-700" title="Start Voice Call">
                <i className="bi bi-telephone-fill text-xl"></i>
              </button>
              <button onClick={() => startCall('video')} className="bg-green-600 p-4 rounded-full shadow-lg hover:bg-green-700" title="Start Video Call">
                <i className="bi bi-camera-video-fill text-xl"></i>
              </button>
            </div>
          )}

          <MeetingControls
            isMuted={isMuted}
            isVideoOff={isVideoOff}
            onToggleMute={() => setIsMuted(!isMuted)}
            onToggleVideo={() => setIsVideoOff(!isVideoOff)}
            onToggleChat={() => setShowChat(!showChat)}
            onToggleParticipants={() => setShowParticipants(!showParticipants)}
            onLeaveMeeting={() => {
              endCall();
              window.location.href = '/';
            }}
          />
        </div>

        {(showChat || showParticipants) && (
          <SidePanel
            messages={messages}
            participants={users.map(u => ({ ...u, isMuted: hostMutedUsers.has(u.id) }))}
            currentUserName={userName}
            currentUserId={socket?.id || ''}
            isHost={isOwner}
            newMessage={newMessage}
            onMessageChange={setNewMessage}
            onSendMessage={handleSendMessage}
            onMuteParticipant={handleMuteParticipant}
            onRemoveParticipant={handleRemoveParticipant}
            hostMutedUsers={hostMutedUsers}
            messagesEndRef={messagesEndRef}
          />
        )}
      </div>
    </div>
  );
}