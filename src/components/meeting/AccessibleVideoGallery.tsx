import React, { useState, useCallback, useRef } from 'react';
import { MeetingParticipant, VideoStream } from '@/types';
import { useAnnouncer, useFocusManagement } from '@/lib/accessibility';

interface AccessibleVideoGalleryProps {
  localStream: MediaStream | null;
  localUserName: string;
  localIsMuted: boolean;
  localIsVideoOff: boolean;
  localIsSpeaking: boolean;
  participants: MeetingParticipant[];
  remoteStreams: Map<string, VideoStream>;
  isHost: boolean;
  gridSize?: 'small' | 'medium' | 'large';
}

interface VideoTileProps {
  participant: MeetingParticipant;
  stream?: MediaStream;
  isLocal?: boolean;
  onSelect?: (participantId: string) => void;
  isSelected?: boolean;
  isFocused?: boolean;
}

const VideoTile: React.FC<VideoTileProps> = ({ 
  participant, 
  stream, 
  isLocal = false, 
  onSelect, 
  isSelected, 
  isFocused 
}) => {
  const videoRef = React.useRef<HTMLVideoElement>(null);
  const tileRef = useRef<HTMLDivElement>(null);

  // Auto-play video when stream is available
  React.useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
      videoRef.current.play().catch(() => {
        // Handle play error silently for accessibility
      });
    }
  }, [stream]);

  const handleKeyDown = (event: React.KeyboardEvent) => {
    switch (event.key) {
      case 'Enter':
      case ' ':
        event.preventDefault();
        onSelect?.(participant.id);
        break;
      case 'ArrowLeft':
      case 'ArrowRight':
      case 'ArrowUp':
      case 'ArrowDown':
        // Let parent handle grid navigation
        break;
      default:
        break;
    }
  };

  const getStatusText = () => {
    const statusParts = [];
    if (participant.isMuted) statusParts.push('muted');
    if (participant.isVideoOff) statusParts.push('video off');
    if (participant.isSpeaking) statusParts.push('speaking');
    if (participant.isHost) statusParts.push('host');
    return statusParts.join(', ');
  };

  return (
    <div
      ref={tileRef}
      role="button"
      tabIndex={0}
      aria-label={`${participant.name} video. ${getStatusText()}. Press Enter to select.`}
      aria-pressed={isSelected}
      onClick={() => onSelect?.(participant.id)}
      onKeyDown={handleKeyDown}
      className="accessible-video-tile"
      style={{
        background: '#000',
        borderRadius: 'var(--radius-md)',
        aspectRatio: '16/9',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
        boxShadow: 'var(--shadow-md)',
        border: isFocused ? '3px solid var(--meeting-accent)' : 'none',
        outline: isSelected ? '3px solid var(--meeting-warning)' : 'none',
        cursor: 'pointer',
        transition: 'all 0.2s ease'
      }}
    >
      {stream && !participant.isVideoOff ? (
        <video
          ref={videoRef}
          autoPlay
          muted={isLocal}
          playsInline
          aria-label={`${participant.name} video stream`}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            borderRadius: 'var(--radius-md)'
          }}
        />
      ) : (
        <div style={{ color: 'white', textAlign: 'center' }}>
          <div style={{ fontSize: '48px', marginBottom: 'var(--space-sm)' }} aria-hidden="true">
            <i className="bi bi-person-circle"></i>
          </div>
          <div style={{ fontSize: '14px', fontWeight: 600 }}>{participant.name}</div>
          {participant.isHost && (
            <div style={{ color: 'var(--meeting-warning)', fontSize: '12px' }} aria-label="Host">
              <i className="bi bi-star-fill"></i> Host
            </div>
          )}
          <div className="meeting-text-secondary" style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: 'var(--space-xs)', 
            justifyContent: 'center',
            flexWrap: 'wrap'
          }}>
            {participant.isMuted && (
              <span aria-label="Muted">
                <i className="bi bi-mic-mute"></i> Muted
              </span>
            )}
            {participant.isVideoOff && (
              <span aria-label="Video off">
                <i className="bi bi-camera-video-off"></i> Video off
              </span>
            )}
            {participant.isSpeaking && (
              <span aria-label="Speaking" style={{ color: 'var(--meeting-success)' }}>
                <i className="bi bi-volume-up"></i> Speaking
              </span>
            )}
          </div>
        </div>
      )}

      {/* Status indicators */}
      <div style={{
        position: 'absolute',
        top: 'var(--space-sm)',
        right: 'var(--space-sm)',
        display: 'flex',
        gap: 'var(--space-xs)'
      }} aria-hidden="true">
        {participant.isMuted && (
          <div style={{
            background: 'rgba(220,53,69,0.8)',
            borderRadius: 'var(--radius-sm)',
            padding: '2px 6px',
            fontSize: '10px'
          }} title="Muted">
            <i className="bi bi-mic-mute"></i>
          </div>
        )}
        {participant.isSpeaking && (
          <div style={{
            background: 'rgba(40,167,69,0.8)',
            borderRadius: 'var(--radius-sm)',
            padding: '2px 6px',
            fontSize: '10px',
            animation: 'pulse 1s infinite'
          }} title="Speaking">
            <i className="bi bi-volume-up"></i>
          </div>
        )}
      </div>

      {/* Selection indicator */}
      {isSelected && (
        <div style={{
          position: 'absolute',
          top: 'var(--space-sm)',
          left: 'var(--space-sm)',
          background: 'var(--meeting-warning)',
          borderRadius: '50%',
          width: '12px',
          height: '12px'
        }} aria-label="Selected"></div>
      )}
    </div>
  );
};

export default function AccessibleVideoGallery({ 
  localStream, 
  localUserName, 
  localIsMuted, 
  localIsVideoOff, 
  localIsSpeaking, 
  participants, 
  remoteStreams, 
  isHost,
  gridSize = 'medium'
}: AccessibleVideoGalleryProps) {
  const [selectedParticipantId, setSelectedParticipantId] = useState<string | null>(null);
  const [focusedIndex, setFocusedIndex] = useState<number>(-1);
  const { announce } = useAnnouncer();
  const galleryRef = useRef<HTMLDivElement>(null);

  const localParticipant: MeetingParticipant = {
    id: 'local',
    name: localUserName,
    isHost,
    isMuted: localIsMuted,
    isVideoOff: localIsVideoOff,
    isSpeaking: localIsSpeaking,
  };

  const allParticipants = [localParticipant, ...participants];

  // Grid sizing for responsive layout
  const getGridConfig = () => {
    switch (gridSize) {
      case 'small':
        return { minWidth: '200px', gap: 'var(--space-sm)' };
      case 'large':
        return { minWidth: '400px', gap: 'var(--space-lg)' };
      case 'medium':
      default:
        return { minWidth: '300px', gap: 'var(--space-md)' };
    }
  };

  const { minWidth, gap } = getGridConfig();

  const handleSelectParticipant = (participantId: string) => {
    setSelectedParticipantId(participantId);
    const participant = allParticipants.find(p => p.id === participantId);
    if (participant) {
      announce(`Selected ${participant.name}'s video`);
    }
  };

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (!galleryRef.current) return;

    const tiles = Array.from(galleryRef.current.querySelectorAll('[role="button"]'));
    const currentIndex = tiles.indexOf(document.activeElement as HTMLElement);

    switch (event.key) {
      case 'ArrowRight':
        event.preventDefault();
        const nextIndex = Math.min(currentIndex + 1, tiles.length - 1);
        (tiles[nextIndex] as HTMLElement).focus();
        setFocusedIndex(nextIndex);
        break;
        
      case 'ArrowLeft':
        event.preventDefault();
        const prevIndex = Math.max(currentIndex - 1, 0);
        (tiles[prevIndex] as HTMLElement).focus();
        setFocusedIndex(prevIndex);
        break;
        
      case 'ArrowDown':
        event.preventDefault();
        // Calculate next row based on grid layout
        const tilesPerRow = Math.floor(galleryRef.current.clientWidth / parseInt(minWidth));
        const downIndex = Math.min(currentIndex + tilesPerRow, tiles.length - 1);
        (tiles[downIndex] as HTMLElement).focus();
        setFocusedIndex(downIndex);
        break;
        
      case 'ArrowUp':
        event.preventDefault();
        // Calculate previous row based on grid layout
        const tilesPerRowUp = Math.floor(galleryRef.current.clientWidth / parseInt(minWidth));
        const upIndex = Math.max(currentIndex - tilesPerRowUp, 0);
        (tiles[upIndex] as HTMLElement).focus();
        setFocusedIndex(upIndex);
        break;
        
      case 'Home':
        event.preventDefault();
        (tiles[0] as HTMLElement).focus();
        setFocusedIndex(0);
        break;
        
      case 'End':
        event.preventDefault();
        (tiles[tiles.length - 1] as HTMLElement).focus();
        setFocusedIndex(tiles.length - 1);
        break;
        
      case ' ': // Space to select
      case 'Enter':
        event.preventDefault();
        if (currentIndex >= 0) {
          const participantId = allParticipants[currentIndex].id;
          handleSelectParticipant(participantId);
        }
        break;
    }
  };

  // Announce participant changes
  React.useEffect(() => {
    if (isScreenReaderOptimized) {
      const speakingParticipants = participants.filter(p => p.isSpeaking);
      if (speakingParticipants.length > 0) {
        const names = speakingParticipants.map(p => p.name).join(', ');
        announce(`${names} ${speakingParticipants.length === 1 ? 'is' : 'are'} speaking`);
      }
    }
  }, [participants, announce, isScreenReaderOptimized]);

  return (
    <section
      ref={galleryRef}
      role="region"
      aria-label="Video gallery"
      aria-describedby="video-gallery-instructions"
      onKeyDown={handleKeyDown}
      style={{
        display: 'grid',
        gridTemplateColumns: `repeat(auto-fit, minmax(${minWidth}, 1fr))`,
        gap: gap,
        padding: 'var(--space-lg)',
        background: '#f5f5f5',
        outline: 'none'
      }}
      tabIndex={0}
    >
      {/* Hidden instructions for screen readers */}
      <div id="video-gallery-instructions" className="sr-only" style={{
        position: 'absolute',
        width: '1px',
        height: '1px',
        padding: 0,
        margin: '-1px',
        overflow: 'hidden',
        clip: 'rect(0, 0, 0, 0)',
        whiteSpace: 'nowrap',
        border: 0
      }}>
        Video gallery. Use arrow keys to navigate between video tiles. 
        Press Enter or Space to select a participant. Press Home to go to first video, End to go to last video.
        Currently showing {allParticipants.length} participants.
      </div>

      {/* Gallery header for screen readers */}
      <div role="heading" aria-level={2} style={{
        position: 'absolute',
        width: '1px',
        height: '1px',
        padding: 0,
        margin: '-1px',
        overflow: 'hidden',
        clip: 'rect(0, 0, 0, 0)',
        whiteSpace: 'nowrap',
        border: 0
      }}>
        Meeting participants video gallery
      </div>

      {allParticipants.map((participant, index) => {
        const remoteStream = participant.id !== 'local' ? remoteStreams.get(participant.id) : undefined;
        return (
          <VideoTile
            key={participant.id}
            participant={participant}
            stream={participant.id === 'local' ? localStream : remoteStream?.stream}
            isLocal={participant.id === 'local'}
            onSelect={handleSelectParticipant}
            isSelected={selectedParticipantId === participant.id}
            isFocused={focusedIndex === index}
          />
        );
      })}

      {/* Status announcement for screen readers */}
      <div 
        role="status" 
        aria-live="polite" 
        aria-atomic="true"
        style={{
          position: 'absolute',
          width: '1px',
          height: '1px',
          padding: 0,
          margin: '-1px',
          overflow: 'hidden',
          clip: 'rect(0, 0, 0, 0)',
          whiteSpace: 'nowrap',
          border: 0
        }}
      >
        {selectedParticipantId 
          ? `${allParticipants.find(p => p.id === selectedParticipantId)?.name || 'Participant'} selected`
          : `${allParticipants.length} participants in gallery`
        }
      </div>
    </section>
  );
}