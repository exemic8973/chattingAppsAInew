import React, { useState, useEffect } from 'react';
import { MeetingParticipant, VideoStream, VideoError, LoadingState, MeetingError } from '@/types';
import LoadingStateComponent from './LoadingState';
import MeetingErrorBoundary from './MeetingErrorBoundary';

interface EnhancedVideoGalleryProps {
  localStream: MediaStream | null;
  localUserName: string;
  localIsMuted: boolean;
  localIsVideoOff: boolean;
  localIsSpeaking: boolean;
  participants: MeetingParticipant[];
  remoteStreams: Map<string, VideoStream>;
  isHost: boolean;
  onStreamError?: (error: VideoError) => void;
  onRetryStream?: (participantId: string) => void;
}

const VideoTile: React.FC<{
  participant: MeetingParticipant;
  stream?: MediaStream;
  isLocal?: boolean;
  onError?: (error: VideoError) => void;
  onRetry?: () => void;
}> = ({ participant, stream, isLocal = false, onError, onRetry }) => {
  const [videoError, setVideoError] = useState<VideoError | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const videoRef = React.useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (videoRef.current && stream) {
      setIsLoading(true);
      videoRef.current.srcObject = stream;
      
      const handleLoadedData = () => setIsLoading(false);
      const handleError = (e: Event) => {
        const error: VideoError = {
          hasError: true,
          error: new Error('Video stream error'),
          errorMessage: 'Failed to load video stream',
          errorType: 'MEDIA_ACCESS_DENIED',
          canRetry: true,
          streamType: isLocal ? 'local' : 'remote',
          participantId: participant.id,
        };
        setVideoError(error);
        if (onError) onError(error);
      };

      videoRef.current.addEventListener('loadeddata', handleLoadedData);
      videoRef.current.addEventListener('error', handleError);

      return () => {
        if (videoRef.current) {
          videoRef.current.removeEventListener('loadeddata', handleLoadedData);
          videoRef.current.removeEventListener('error', handleError);
        }
      };
    }
  }, [stream, participant.id, isLocal, onError]);

  const handleRetry = () => {
    setVideoError(null);
    setIsLoading(true);
    if (onRetry) onRetry();
  };

  if (videoError) {
    return (
      <div className="video-tile-error" style={{ 
        background: '#000', 
        borderRadius: 'var(--radius-md)', 
        aspectRatio: '16/9', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        position: 'relative',
        boxShadow: 'var(--shadow-md)',
        border: '2px solid var(--meeting-danger)'
      }}>
        <div style={{ color: 'white', textAlign: 'center', padding: 'var(--space-md)' }}>
          <div style={{ fontSize: '32px', marginBottom: 'var(--space-sm)', color: 'var(--meeting-danger)' }}>
            <i className="bi bi-camera-video-off"></i>
          </div>
          <div style={{ fontSize: '14px', fontWeight: 600, marginBottom: 'var(--space-xs)' }}>
            Camera Error
          </div>
          <div className="meeting-text-secondary" style={{ marginBottom: 'var(--space-md)' }}>
            {videoError.errorMessage}
          </div>
          
          {videoError.canRetry && (
            <button 
              onClick={handleRetry}
              className="meeting-button meeting-button-primary"
              style={{ fontSize: '12px' }}
            >
              <i className="bi bi-arrow-clockwise meeting-icon"></i>
              Retry
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="video-tile" style={{ 
      background: '#000', 
      borderRadius: 'var(--radius-md)', 
      aspectRatio: '16/9', 
      display: 'flex', 
      alignItems: 'center', 
      justifyContent: 'center',
      position: 'relative',
      boxShadow: 'var(--shadow-md)'
    }}>
      {stream && !participant.isVideoOff ? (
        <video
          ref={videoRef}
          autoPlay
          muted={isLocal}
          playsInline
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            borderRadius: 'var(--radius-md)',
            display: isLoading ? 'none' : 'block'
          }}
        />
      ) : (
        <div style={{ color: 'white', textAlign: 'center' }}>
          <div style={{ fontSize: '48px', marginBottom: 'var(--space-sm)' }}>
            <i className="bi bi-person-circle"></i>
          </div>
          <div style={{ fontSize: '14px', fontWeight: 600 }}>{participant.name}</div>
          {participant.isHost && (
            <div style={{ color: 'var(--meeting-warning)', fontSize: '12px' }}>
              <i className="bi bi-star-fill"></i> Host
            </div>
          )}
          <div className="meeting-text-secondary" style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-xs)', justifyContent: 'center' }}>
            <i className={`bi ${participant.isMuted ? 'bi-mic-mute' : 'bi-mic'}`}></i>
            <span>{participant.isMuted ? 'Muted' : 'Active'}</span>
          </div>
          {participant.isSpeaking && (
            <div style={{ color: 'var(--meeting-success)', display: 'flex', alignItems: 'center', gap: 'var(--space-xs)', justifyContent: 'center' }}>
              <i className="bi bi-volume-up"></i>
              <span>Speaking</span>
            </div>
          )}
        </div>
      )}

      {isLoading && (
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'rgba(0,0,0,0.7)',
          borderRadius: 'var(--radius-md)'
        }}>
          <LoadingStateComponent
            isLoading={true}
            loadingMessage="Loading video..."
            variant="spinner"
            size="sm"
          />
        </div>
      )}

      {/* Status indicators */}
      <div style={{
        position: 'absolute',
        top: 'var(--space-sm)',
        right: 'var(--space-sm)',
        display: 'flex',
        gap: 'var(--space-xs)'
      }}>
        {participant.isMuted && (
          <div style={{
            background: 'rgba(220,53,69,0.8)',
            borderRadius: 'var(--radius-sm)',
            padding: '2px 6px',
            fontSize: '10px'
          }}>
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
          }}>
            <i className="bi bi-volume-up"></i>
          </div>
        )}
      </div>
    </div>
  );
};

export default function EnhancedVideoGallery({ 
  localStream, 
  localUserName, 
  localIsMuted, 
  localIsVideoOff, 
  localIsSpeaking, 
  participants, 
  remoteStreams, 
  isHost,
  onStreamError,
  onRetryStream
}: EnhancedVideoGalleryProps) {
  const [galleryError, setGalleryError] = useState<MeetingError | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const localParticipant: MeetingParticipant = {
    id: 'local',
    name: localUserName,
    isHost,
    isMuted: localIsMuted,
    isVideoOff: localIsVideoOff,
    isSpeaking: localIsSpeaking,
  };

  const handleStreamError = (error: VideoError) => {
    setGalleryError(error);
    if (onStreamError) onStreamError(error);
  };

  const handleRetry = () => {
    setGalleryError(null);
    setIsLoading(true);
    // Simulate retry operation
    setTimeout(() => {
      setIsLoading(false);
    }, 2000);
  };

  if (galleryError && !galleryError.canRetry) {
    return (
      <MeetingErrorBoundary
        fallback={(error, recovery) => (
          <div className="video-gallery-error" style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 'var(--space-lg)',
            background: '#f5f5f5',
            borderRadius: 'var(--radius-md)',
            minHeight: '300px',
            textAlign: 'center'
          }}>
            <div style={{ fontSize: '48px', marginBottom: 'var(--space-md)', color: 'var(--meeting-danger)' }}>
              <i className="bi bi-exclamation-triangle-fill"></i>
            </div>
            <h3>Video Gallery Error</h3>
            <p className="meeting-text-secondary">{error.errorMessage}</p>
            <div style={{ display: 'flex', gap: 'var(--space-sm)', marginTop: 'var(--space-md)' }}>
              {recovery.canRetry && (
                <button onClick={recovery.retryAction} className="meeting-button meeting-button-primary">
                  Retry
                </button>
              )}
              {recovery.canReset && (
                <button onClick={recovery.resetAction} className="meeting-button meeting-button-warning">
                  Reset
                </button>
              )}
            </div>
          </div>
        )}
      >
        <div className="video-gallery" style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', 
          gap: 'var(--space-md)', 
          padding: 'var(--space-lg)',
          background: '#f5f5f5'
        }}>
          {isLoading && (
            <div style={{ gridColumn: '1 / -1' }}>
              <LoadingStateComponent
                isLoading={true}
                loadingMessage="Reconnecting video streams..."
                loadingProgress={45}
                variant="spinner"
              />
            </div>
          )}

          {!isLoading && (
            <>
              {/* Local Video Tile */}
              <VideoTile
                participant={localParticipant}
                stream={localStream || undefined}
                isLocal={true}
                onError={handleStreamError}
                onRetry={handleRetry}
              />

              {/* Remote Video Tiles */}
              {participants.map((participant) => {
                const remoteStream = remoteStreams.get(participant.id);
                return (
                  <VideoTile
                    key={participant.id}
                    participant={participant}
                    stream={remoteStream?.stream}
                    onError={handleStreamError}
                    onRetry={() => onRetryStream?.(participant.id)}
                  />
                );
              })}
            </>
          )}
        </div>
      </MeetingErrorBoundary>
    );
  }

  return (
    <MeetingErrorBoundary>
      <div className="video-gallery" style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', 
        gap: 'var(--space-md)', 
        padding: 'var(--space-lg)',
        background: '#f5f5f5'
      }}>
        {isLoading && (
          <div style={{ gridColumn: '1 / -1' }}>
            <LoadingStateComponent
              isLoading={true}
              loadingMessage="Loading video gallery..."
              variant="spinner"
            />
          </div>
        )}

        {!isLoading && (
          <>
            {/* Local Video Tile */}
            <VideoTile
              participant={localParticipant}
              stream={localStream || undefined}
              isLocal={true}
              onError={handleStreamError}
              onRetry={handleRetry}
            />

            {/* Remote Video Tiles */}
            {participants.map((participant) => {
              const remoteStream = remoteStreams.get(participant.id);
              return (
                <VideoTile
                  key={participant.id}
                  participant={participant}
                  stream={remoteStream?.stream}
                  onError={handleStreamError}
                  onRetry={() => onRetryStream?.(participant.id)}
                />
              );
            })}
          </>
        )}
      </div>
    </MeetingErrorBoundary>
  );
}