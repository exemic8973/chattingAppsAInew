'use client';

import { useEffect, useRef } from 'react';

interface VideoTileProps {
  stream?: MediaStream | null;
  userName: string;
  isLocal?: boolean;
  isMuted?: boolean;
  isVideoOff?: boolean;
  isSpeaking?: boolean;
  isHost?: boolean;
}

export default function VideoTile({
  stream,
  userName,
  isLocal = false,
  isMuted = false,
  isVideoOff = false,
  isSpeaking = false,
  isHost = false
}: VideoTileProps) {
  const videoRef = useRef<HTMLVideoElement>(null);

  // Attach stream to video element
  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  const getInitial = () => {
    return userName?.charAt(0)?.toUpperCase() || '?';
  };

  return (
    <div
      className={`video-tile position-relative rounded overflow-hidden ${isSpeaking ? 'speaking' : ''} ${isHost ? 'host' : ''}`}
      style={{
        background: '#1a1a1a',
        aspectRatio: '16/9',
        border: isSpeaking ? '3px solid #0078d4' : isHost ? '2px solid #ffd700' : '2px solid transparent',
        transition: 'border-color 0.2s ease'
      }}
    >
      {/* Video element */}
      {stream && !isVideoOff ? (
        <video
          ref={videoRef}
          autoPlay
          muted={isLocal} // Mute local video to avoid feedback
          playsInline
          className="w-100 h-100"
          style={{
            objectFit: 'cover',
            transform: isLocal ? 'scaleX(-1)' : 'none' // Mirror local video
          }}
        />
      ) : (
        // Avatar fallback when video is off
        <div className="d-flex align-items-center justify-content-center h-100 w-100">
          <div
            className="avatar-circle bg-primary rounded-circle d-flex align-items-center justify-content-center"
            style={{
              width: '80px',
              height: '80px',
              fontSize: '32px',
              fontWeight: 'bold',
              color: '#fff',
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
            }}
          >
            {getInitial()}
          </div>
        </div>
      )}

      {/* Overlay - User info */}
      <div
        className="position-absolute bottom-0 start-0 end-0 p-2"
        style={{
          background: 'linear-gradient(to top, rgba(0,0,0,0.8), transparent)',
          pointerEvents: 'none'
        }}
      >
        <div className="d-flex align-items-center justify-content-between">
          <div className="d-flex align-items-center gap-2">
            {/* Mic status icon */}
            {isMuted && (
              <i
                className="bi bi-mic-mute-fill text-danger"
                style={{ fontSize: '0.9rem' }}
              ></i>
            )}

            {/* User name */}
            <span
              className="text-white fw-medium"
              style={{
                fontSize: '0.85rem',
                textShadow: '0 1px 2px rgba(0,0,0,0.8)'
              }}
            >
              {userName} {isLocal && '(You)'}
            </span>
          </div>

          {/* Host badge */}
          {isHost && (
            <span
              className="badge"
              style={{
                background: '#ffd700',
                color: '#000',
                fontSize: '0.7rem',
                fontWeight: 'bold'
              }}
            >
              HOST
            </span>
          )}
        </div>
      </div>

      {/* Video off indicator */}
      {isVideoOff && (
        <div
          className="position-absolute top-50 start-50 translate-middle"
          style={{ pointerEvents: 'none' }}
        >
          <i
            className="bi bi-camera-video-off-fill text-secondary"
            style={{ fontSize: '2rem', opacity: 0.5 }}
          ></i>
        </div>
      )}
    </div>
  );
}
