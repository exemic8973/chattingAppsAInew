import React from 'react';
import { MeetingParticipant, VideoStream } from '@/types';

interface VideoGalleryProps {
  localStream: MediaStream | null;
  localUserName: string;
  localIsMuted: boolean;
  localIsVideoOff: boolean;
  localIsSpeaking: boolean;
  participants: MeetingParticipant[];
  remoteStreams: Map<string, VideoStream>;
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
      gap: 'var(--space-md)', 
      padding: 'var(--space-lg)',
      background: '#f5f5f5'
    }}>
      {/* Local Video Tile */}
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
        <div style={{ color: 'white', textAlign: 'center' }}>
          <div style={{ fontSize: '48px', marginBottom: 'var(--space-sm)' }}>
            <i className="bi bi-person-circle"></i>
          </div>
          <div style={{ fontSize: '14px', fontWeight: 600 }}>{localUserName} (You)</div>
          <div className="meeting-text-secondary" style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-xs)', justifyContent: 'center' }}>
            <i className={`bi ${localIsMuted ? 'bi-mic-mute' : 'bi-mic'}`}></i>
            <span>{localIsMuted ? 'Muted' : 'Unmuted'}</span>
            <span>•</span>
            <i className={`bi ${localIsVideoOff ? 'bi-camera-video-off' : 'bi-camera-video'}`}></i>
            <span>{localIsVideoOff ? 'Camera Off' : 'Camera On'}</span>
          </div>
          {localIsSpeaking && (
            <div style={{ color: 'var(--meeting-success)', display: 'flex', alignItems: 'center', gap: 'var(--space-xs)', justifyContent: 'center' }}>
              <i className="bi bi-volume-up"></i>
              <span>Speaking</span>
            </div>
          )}
        </div>
      </div>

      {/* Remote Video Tiles */}
      {participants.map((participant) => {
        const remoteStream = remoteStreams.get(participant.id);
        return (
          <div key={participant.id} className="video-tile" style={{ 
            background: '#000', 
            borderRadius: 'var(--radius-md)', 
            aspectRatio: '16/9', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center',
            position: 'relative',
            boxShadow: 'var(--shadow-md)'
          }}>
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
          </div>
        );
      })}
    </div>
  );
}