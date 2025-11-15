import React from 'react';

interface Participant {
  id: string;
  name: string;
  isHost: boolean;
  isMuted?: boolean;
  isVideoOff?: boolean;
  isSpeaking?: boolean;
}

interface RemoteStream {
  stream: MediaStream;
  userName?: string;
}

interface VideoGalleryProps {
  localStream: MediaStream | null;
  localUserName: string;
  localIsMuted: boolean;
  localIsVideoOff: boolean;
  localIsSpeaking: boolean;
  participants: Participant[];
  remoteStreams: Map<string, RemoteStream>;
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
  return (
    <div className="video-gallery" style={{ 
      display: 'grid', 
      gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', 
      gap: '10px', 
      padding: '20px',
      background: '#f5f5f5'
    }}>
      {/* Local Video Tile */}
      <div className="video-tile" style={{ 
        background: '#000', 
        borderRadius: '8px', 
        aspectRatio: '16/9', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        position: 'relative'
      }}>
        <div style={{ color: 'white', textAlign: 'center' }}>
          <div style={{ fontSize: '48px', marginBottom: '10px' }}>👤</div>
          <div style={{ fontSize: '14px' }}>{localUserName} (You)</div>
          <div style={{ fontSize: '12px', opacity: 0.7 }}>
            {localIsMuted ? '🔇 Muted' : '🎤 Unmuted'} | {localIsVideoOff ? '📹 Camera Off' : '📹 Camera On'}
          </div>
          {localIsSpeaking && <div style={{ color: '#4CAF50' }}>🗣️ Speaking</div>}
        </div>
      </div>

      {/* Remote Video Tiles */}
      {participants.map((participant) => {
        const remoteStream = remoteStreams.get(participant.id);
        return (
          <div key={participant.id} className="video-tile" style={{ 
            background: '#000', 
            borderRadius: '8px', 
            aspectRatio: '16/9', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center',
            position: 'relative'
          }}>
            <div style={{ color: 'white', textAlign: 'center' }}>
              <div style={{ fontSize: '48px', marginBottom: '10px' }}>👤</div>
              <div style={{ fontSize: '14px' }}>{participant.name}</div>
              <div style={{ fontSize: '12px', opacity: 0.7 }}>
                {participant.isMuted ? '🔇 Muted' : '🎤 Unmuted'}
              </div>
              {participant.isSpeaking && <div style={{ color: '#4CAF50' }}>🗣️ Speaking</div>}
            </div>
          </div>
        );
      })}
    </div>
  );
}