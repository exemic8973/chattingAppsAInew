'use client';

import VideoTile from './VideoTile';
import { User } from '@/types';

interface Participant extends User {
  stream?: MediaStream | null;
  isMuted?: boolean;
  isVideoOff?: boolean;
  isSpeaking?: boolean;
}

interface VideoGalleryProps {
  localStream?: MediaStream | null;
  localUserName: string;
  localIsMuted: boolean;
  localIsVideoOff: boolean;
  localIsSpeaking: boolean;
  participants: Participant[];
  remoteStreams: Map<string, { stream: MediaStream; userName?: string }>;
  isHost: boolean;
}

export default function VideoGallery({
  localStream,
  localUserName,
  localIsMuted,
  localIsVideoOff,
  localIsSpeaking,
  participants,
  remoteStreams,
  isHost
}: VideoGalleryProps) {
  // Calculate grid layout based on participant count
  const totalParticipants = 1 + participants.length; // 1 (local) + others

  const getGridClass = () => {
    if (totalParticipants === 1) return 'video-gallery-single';
    if (totalParticipants === 2) return 'video-gallery-dual';
    if (totalParticipants <= 4) return 'video-gallery-quad';
    if (totalParticipants <= 9) return 'video-gallery-nine';
    return 'video-gallery-many';
  };

  return (
    <div
      className={`video-gallery ${getGridClass()} p-3`}
      style={{
        flex: 1,
        display: 'grid',
        gap: '12px',
        overflow: 'auto',
        background: '#252525'
      }}
    >
      {/* Local user (you) */}
      <VideoTile
        stream={localStream}
        userName={localUserName}
        isLocal={true}
        isMuted={localIsMuted}
        isVideoOff={localIsVideoOff}
        isSpeaking={localIsSpeaking}
        isHost={isHost}
      />

      {/* Remote participants */}
      {participants.map((participant) => {
        const remoteData = remoteStreams.get(participant.id);
        return (
          <VideoTile
            key={participant.id}
            stream={remoteData?.stream || null}
            userName={participant.name}
            isLocal={false}
            isMuted={participant.isMuted || false}
            isVideoOff={participant.isVideoOff || false}
            isSpeaking={participant.isSpeaking || false}
            isHost={participant.isHost || false}
          />
        );
      })}
    </div>
  );
}
